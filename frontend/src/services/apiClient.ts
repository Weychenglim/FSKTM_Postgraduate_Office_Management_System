/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Thin API client shared by every *Api.ts service.
 *
 * Dashboard/Timeline, Supervisor, Panel, Marks, and Workflow services always
 * call Django. `USE_MOCKS` remains available only to unfinished or
 * teammate-owned modules while their persistence integrations are completed.
 */

import { AuthSession } from './authSession';
import { TAB_NAME } from './browserTab';

const parseBooleanEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const parseNumberEnv = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const USE_MOCKS = parseBooleanEnv(import.meta.env?.VITE_USE_MOCKS, true);
export const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL?.trim() || '/api';
const authSession = new AuthSession(
  (input, init) => fetch(input, init),
  `${API_BASE_URL}/auth/refresh/`,
  TAB_NAME,
);

// Simulated network latency for mock responses (ms).
const MOCK_LATENCY_MS = parseNumberEnv(import.meta.env?.VITE_MOCK_LATENCY_MS, 500);

export class ApiError extends Error {
  status?: number;
  body?: unknown;
  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** The first message for each field of a 400 response, e.g. `{ name: 'Required.' }`. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || err.status !== 400) return {};
  const body = err.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const errors: Record<string, string> = {};
  for (const [field, value] of Object.entries(body as Record<string, unknown>)) {
    if (typeof value === 'string') errors[field] = value;
    else if (Array.isArray(value) && typeof value[0] === 'string') errors[field] = value[0];
  }
  return errors;
}

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Fired when the backend rejects our token, so the app can return to login. */
export const SESSION_EXPIRED_EVENT = 'fsktm:session-expired';

/** Fired when the backend holds the account until its password is changed. */
export const PASSWORD_CHANGE_REQUIRED_EVENT = 'fsktm:password-change-required';

/**
 * Whether a failed request may fall back to mock data.
 *
 * Only genuine transport failures qualify: the server being unreachable. A
 * response that carried an HTTP status (401, 403, 404, 500…) is a real answer
 * and must surface as an error: silently swapping in fixtures would render
 * invented records as though they were live data.
 */
export function isTransportFailure(err: unknown): boolean {
  return !(err instanceof ApiError) || err.status === undefined;
}

/**
 * Wrap mock data so callers get the same async shape (and a deep copy, so they
 * can't accidentally mutate the shared mock arrays) they will get from HTTP.
 */
export async function mockResponse<T>(
  data: T,
  options?: { latencyMs?: number; failRate?: number }
): Promise<T> {
  await delay(options?.latencyMs ?? MOCK_LATENCY_MS);
  if (options?.failRate && Math.random() < options.failRate) {
    throw new ApiError('Simulated network error. Please try again.');
  }
  return typeof structuredClone === 'function'
    ? structuredClone(data)
    : (JSON.parse(JSON.stringify(data)) as T);
}

// Token management

export function setAuthToken(token: string): void {
  authSession.setAccessToken(token);
}

export function clearAuthToken(): void {
  authSession.clearAccessToken();
}

export function getAuthToken(): string | null {
  return authSession.getAccessToken();
}

export function getAuthSessionVersion(): number {
  return authSession.getSessionVersion();
}

export function refreshAuthToken(): Promise<string | null> {
  return authSession.refreshAccessToken();
}

// HTTP helper

/**
 * Pull a human-readable message out of an error response body. Handles our
 * Django/DRF shapes: `{ error }`, `{ detail }`, field errors like
 * `{ new_password: ["too short", ...] }`, and nested ones like
 * `{ preferences: { announcementAlerts: ["..."] } }`.
 */
function messageFromErrorBody(body: unknown): string | null {
  if (typeof body === 'string') return body.trim() || null;
  if (Array.isArray(body)) {
    for (const item of body) {
      const message = messageFromErrorBody(item);
      if (message) return message;
    }
    return null;
  }
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (typeof record.error === 'string') return record.error;
  if (typeof record.detail === 'string') return record.detail;
  for (const [key, value] of Object.entries(record)) {
    if (key === 'code') continue;
    const message = messageFromErrorBody(value);
    if (message) return message;
  }
  return null;
}

const UNAVAILABLE_STATUSES = new Set([502, 503, 504]);

export async function request<T>(
  path: string,
  init?: RequestInit,
  options?: { retryAuth?: boolean },
): Promise<T> {
  const isFormDataBody = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  const res = await sessionFetch(
    path,
    { ...init, headers },
    options?.retryAuth ?? true,
  );
  if (!res.ok) return raiseForStatus(res);
  // 204 No Content (or empty body) → nothing to parse.
  if (res.status === 204) return undefined as T;
  try {
    return (await res.json()) as T;
  } catch {
    // A 200 carrying HTML (proxy or SSO interstitial) is a server problem, not
    // a transport failure. Surface it as an ApiError so callers cannot mistake
    // it for "offline" and quietly substitute mock data.
    throw new ApiError('The server returned an unreadable response.', res.status);
  }
}

/**
 * An expired or invalid token means the stored session is worthless. Drop it and
 * let the app root send the user back to login, rather than leaving every later
 * call to fail with an opaque message.
 */
function handleUnauthorized(): void {
  if (getAuthToken() !== null) clearAuthToken();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
}

async function sessionFetch(
  path: string,
  init: RequestInit,
  retryAuth = true,
): Promise<Response> {
  const hadSession = authSession.getAccessToken() !== null;
  const sessionVersion = authSession.getSessionVersion();
  const res = await authSession.fetch(`${API_BASE_URL}${path}`, init, retryAuth);
  // A 401 for a session that was signed out or replaced while the request was
  // in flight says nothing about the current one.
  if (res.status === 401 && hadSession && authSession.getSessionVersion() === sessionVersion) {
    handleUnauthorized();
  }
  return res;
}

/** Build and throw an ApiError from a non-OK response (shared by the helpers below). */
async function raiseForStatus(res: Response): Promise<never> {
  let message = `Request failed: ${res.status} ${res.statusText}`;
  const text = await res.text().catch(() => '');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    // Not JSON: a proxy or server error page. An empty 500 is what the dev
    // proxy sends when Django is down; 502-504 come from a gateway.
    if (res.status >= 500) {
      message = UNAVAILABLE_STATUSES.has(res.status) || !text.trim()
        ? 'The server is unavailable. Please try again shortly.'
        : 'The server ran into a problem. Please try again shortly.';
    }
    throw new ApiError(message, res.status);
  }
  const code = body && typeof body === 'object' ? (body as { code?: unknown }).code : undefined;
  const extracted = messageFromErrorBody(body);
  if (extracted) message = extracted;
  if (res.status === 403 && typeof window !== 'undefined') {
    if (code === 'password_change_required') {
      window.dispatchEvent(new CustomEvent(PASSWORD_CHANGE_REQUIRED_EVENT));
    } else if (code === 'technical_account' && getAuthToken() !== null) {
      // The account became a technical (admin-site only) account mid-session.
      clearAuthToken();
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { message } }));
    }
  }
  throw new ApiError(message, res.status, body);
}

/**
 * Send a `multipart/form-data` body (used for file uploads). The browser sets
 * `Content-Type` with the correct boundary, so we must NOT set it ourselves.
 */
export async function requestMultipart<T>(
  path: string,
  formData: FormData,
  init?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  const res = await sessionFetch(path, {
    method: 'POST',
    ...init,
    body: formData,
    headers,
  });
  if (!res.ok) return raiseForStatus(res);
  if (res.status === 204) return undefined as T;
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError('The server returned an unreadable response.', res.status);
  }
}

/** Fetch a binary file (with auth) as a Blob, used for attachment downloads. */
export async function requestBlob(path: string, init?: RequestInit): Promise<Blob> {
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  const res = await sessionFetch(path, { ...init, headers });
  if (!res.ok) return raiseForStatus(res);
  return res.blob();
}
