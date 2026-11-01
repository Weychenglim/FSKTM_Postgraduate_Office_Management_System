type RefreshPayload = {
  token?: unknown;
};

const TAB_HEADER = 'X-Portal-Tab';

function tokenUser(token: string): unknown {
  try {
    const payload = token.split('.')[1] ?? '';
    return (JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { user_id?: unknown }).user_id;
  } catch {
    return undefined;
  }
}


export class AuthSession {
  private accessToken: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;
  private sessionVersion = 0;

  constructor(
    private readonly fetcher: typeof fetch,
    private readonly refreshUrl: string,
    private readonly tabName: string | null = null,
  ) {}

  private withTab(headers: Headers): Headers {
    if (this.tabName) headers.set(TAB_HEADER, this.tabName);
    return headers;
  }

  setAccessToken(token: string): void {
    this.sessionVersion += 1;
    this.accessToken = token;
  }

  clearAccessToken(): void {
    this.sessionVersion += 1;
    this.accessToken = null;
  }

  getSessionVersion(): number {
    return this.sessionVersion;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  refreshAccessToken(): Promise<string | null> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.performRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async performRefresh(): Promise<string | null> {
    const sessionVersion = this.sessionVersion;
    const signedInAs = this.accessToken ? tokenUser(this.accessToken) : undefined;
    try {
      const response = await this.fetcher(this.refreshUrl, {
        method: 'POST',
        credentials: 'include',
        headers: this.withTab(new Headers({ 'Content-Type': 'application/json' })),
        body: this.accessToken ? JSON.stringify({ resume: true }) : undefined,
      });
      if (this.sessionVersion !== sessionVersion) return null;
      if (!response.ok) {
        this.accessToken = null;
        return null;
      }

      const payload = (await response.json()) as RefreshPayload;
      if (this.sessionVersion !== sessionVersion) return null;
      if (typeof payload.token !== 'string' || payload.token.length === 0) {
        this.accessToken = null;
        return null;
      }
      // A tab never changes account on its own: another account's renewal ends this session.
      if (signedInAs !== undefined && tokenUser(payload.token) !== signedInAs) {
        this.accessToken = null;
        return null;
      }

      // Refresh rotates a credential within the same login session.
      this.accessToken = payload.token;
      return payload.token;
    } catch {
      if (this.sessionVersion === sessionVersion) this.accessToken = null;
      return null;
    }
  }

  async fetch(
    input: RequestInfo | URL,
    init?: RequestInit,
    retryOnUnauthorized = true,
  ): Promise<Response> {
    const sessionVersion = this.sessionVersion;
    const response = await this.fetchWithCurrentToken(input, init);
    if (this.sessionVersion !== sessionVersion || response.status !== 401 || !this.accessToken || !retryOnUnauthorized) {
      return response;
    }

    const renewedToken = await this.refreshAccessToken();
    if (!renewedToken || this.sessionVersion !== sessionVersion) return response;
    return this.fetchWithCurrentToken(input, init);
  }

  private fetchWithCurrentToken(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const headers = this.withTab(new Headers(init?.headers));
    if (this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    } else {
      headers.delete('Authorization');
    }
    return this.fetcher(input, {
      ...init,
      credentials: 'include',
      headers,
    });
  }
}
