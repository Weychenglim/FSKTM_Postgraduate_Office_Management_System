import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';


const apiClientSource = readFileSync(resolve('src/services/apiClient.ts'), 'utf8');
assert.doesNotMatch(apiClientSource, /localStorage|sessionStorage/);
const authApiSource = readFileSync(resolve('src/services/authApi.ts'), 'utf8');
const appSource = readFileSync(resolve('src/App.tsx'), 'utf8');
assert.match(authApiSource, /export async function restoreSession/);
assert.match(authApiSource, /refreshAuthToken/);
assert.match(appSource, /authApi\s*\.restoreSession\(\)/);
assert.doesNotMatch(appSource, /getAuthToken/);
assert.match(
  appSource,
  /useEffect\(\(\) => \{[\s\S]{0,250}pathname === APP_ROUTES\.resetPassword/,
);

type SessionContract = {
  setAccessToken(token: string): void;
  getAccessToken(): string | null;
  clearAccessToken(): void;
  refreshAccessToken(): Promise<string | null>;
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

type SessionConstructor = new (
  fetcher: typeof fetch,
  refreshUrl: string,
  tabName?: string | null,
) => SessionContract;

let AuthSession: SessionConstructor;
try {
  const modulePath = './authSession.ts';
  const sessionModule = await import(modulePath);
  AuthSession = sessionModule.AuthSession as SessionConstructor;
} catch (error) {
  assert.fail(`AuthSession must be implemented: ${String(error)}`);
}

{
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let protectedCalls = 0;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === '/api/auth/refresh/') {
      return new Response(JSON.stringify({ token: 'renewed-access-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    protectedCalls += 1;
    return protectedCalls === 1
      ? new Response(null, { status: 401 })
      : new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
  }) as typeof fetch;

  const session = new AuthSession(fetcher, '/api/auth/refresh/');
  session.setAccessToken('expired-access-token');
  const response = await session.fetch('/api/private/');

  assert.equal(response.status, 200);
  assert.equal(session.getAccessToken(), 'renewed-access-token');
  assert.equal(calls.length, 3);
  assert.equal(
    new Headers(calls[0].init?.headers).get('Authorization'),
    'Bearer expired-access-token',
  );
  assert.equal(calls[1].url, '/api/auth/refresh/');
  assert.equal(new Headers(calls[1].init?.headers).get('Authorization'), null);
  assert.equal(calls[1].init?.credentials, 'include');
  assert.equal(
    new Headers(calls[2].init?.headers).get('Authorization'),
    'Bearer renewed-access-token',
  );
}

{
  let resolveRefresh: ((response: Response) => void) | undefined;
  let refreshCalls = 0;
  const fetcher = (async () => {
    refreshCalls += 1;
    return new Promise<Response>((resolvePromise) => {
      resolveRefresh = resolvePromise;
    });
  }) as typeof fetch;
  const session = new AuthSession(fetcher, '/api/auth/refresh/');

  const first = session.refreshAccessToken();
  const second = session.refreshAccessToken();
  await Promise.resolve();
  assert.equal(refreshCalls, 1);
  resolveRefresh?.(
    new Response(JSON.stringify({ token: 'shared-access-token' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

  assert.equal(await first, 'shared-access-token');
  assert.equal(await second, 'shared-access-token');
  assert.equal(session.getAccessToken(), 'shared-access-token');
}

{
  let calls = 0;
  const fetcher = (async () => {
    calls += 1;
    return new Response(null, { status: 401 });
  }) as typeof fetch;
  const session = new AuthSession(fetcher, '/api/auth/refresh/');
  session.setAccessToken('invalid-access-token');

  const response = await session.fetch('/api/private/');

  assert.equal(response.status, 401);
  assert.equal(calls, 2);
  assert.equal(session.getAccessToken(), null);
}

for (const outcome of ['success', 'failure', 'network'] as const) {
  let finish!: (value: Response) => void;
  let fail!: (error: Error) => void;
  const session = new AuthSession((() => new Promise<Response>((resolve, reject) => { finish = resolve; fail = reject; })) as typeof fetch, '/api/auth/refresh/');
  session.setAccessToken('session-a');
  const pending = session.refreshAccessToken();
  session.setAccessToken('session-b');
  if (outcome === 'network') fail(new Error('disconnected'));
  else finish(new Response(JSON.stringify({ token: 'old-session-renewal' }), { status: outcome === 'success' ? 200 : 401 }));
  assert.equal(await pending, null);
  assert.equal(session.getAccessToken(), 'session-b', 'an old refresh must not replace or clear a new login');
}

const jwtFor = (userId: number) =>
  `header.${Buffer.from(JSON.stringify({ user_id: userId, jti: Math.random() })).toString('base64url')}.signature`;

{
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ token: jwtFor(7) }), { status: 200 });
  }) as typeof fetch;
  const session = new AuthSession(fetcher, '/api/auth/refresh/', 'tab-one-1234');

  assert.equal(await session.refreshAccessToken() !== null, true);
  assert.equal(new Headers(calls[0].init?.headers).get('X-Portal-Tab'), 'tab-one-1234', 'the refresh names the tab');
  assert.equal(calls[0].init?.body, undefined, 'a tab starting up may begin from the browser sign-in');

  await session.fetch('/api/private/');
  assert.equal(new Headers(calls[1].init?.headers).get('X-Portal-Tab'), 'tab-one-1234', 'every request names the tab');

  await session.refreshAccessToken();
  assert.equal(calls[2].init?.body, JSON.stringify({ resume: true }), 'a signed-in tab only renews its own sign-in');
}

{
  let next = jwtFor(7);
  const fetcher = (async () => new Response(JSON.stringify({ token: next }), { status: 200 })) as typeof fetch;
  const session = new AuthSession(fetcher, '/api/auth/refresh/', 'tab-one-1234');
  session.setAccessToken(jwtFor(7));
  next = jwtFor(9);
  assert.equal(await session.refreshAccessToken(), null, 'a renewal for another account ends the session');
  assert.equal(session.getAccessToken(), null);

  session.setAccessToken(jwtFor(7));
  next = jwtFor(7);
  assert.equal(await session.refreshAccessToken(), next, 'the same account renews as before');
}

{
  const calls: RequestInit[] = [];
  const session = new AuthSession((async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(init ?? {});
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch, '/api/auth/refresh/');
  await session.fetch('/api/private/');
  assert.equal(new Headers(calls[0].headers).has('X-Portal-Tab'), false, 'without a tab name nothing is added');
}

console.log('JWT API session tests passed.');
