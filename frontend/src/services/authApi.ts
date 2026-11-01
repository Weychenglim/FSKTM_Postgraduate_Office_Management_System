/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Authentication API. Talks to the real Django backend (`/api/auth/*`); auth
 * is always live, regardless of the `USE_MOCKS` flag used by the data services.
 *
 * On login, the access JWT is held in memory while the browser manages the
 * HttpOnly refresh cookie. API requests continue using the bearer header.
 */

import { APP_ROUTES } from '../constants/routes';
import { DemoUser } from '../types';
import type { PasswordLinkKind } from '../utils/passwordLinkCopy';
import {
  ApiError,
  clearAuthToken,
  delay,
  getAuthSessionVersion,
  refreshAuthToken,
  request,
  setAuthToken,
} from './apiClient';
import { otherOpenTabs } from './browserTab';

export interface LoginResponse {
  token: string;
  user: DemoUser;
}

const PUBLIC_PATHS: readonly string[] = [
  APP_ROUTES.root,
  APP_ROUTES.login,
  APP_ROUTES.forgotPassword,
  APP_ROUTES.resetPassword,
  APP_ROUTES.activateAccount,
];

/** A reload on a portal page (not the sign-in pages) means a session was likely open. */
function onPortalPage(): boolean {
  return typeof window !== 'undefined' && !PUBLIC_PATHS.includes(window.location.pathname);
}

// The latest sign-out request. Sign-in waits for it, so a late logout response
// cannot delete the refresh cookie that the new sign-in has just set.
let pendingLogout: Promise<void> = Promise.resolve();

/**
 * Sign in. With rememberMe the session survives closing the browser for the
 * refresh lifetime; without it the session ends when the browser closes.
 */
export async function login(identifier: string, password: string, rememberMe = false): Promise<LoginResponse> {
  await pendingLogout;
  const res = await request<LoginResponse>('/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ identifier, password, rememberMe }),
  }, { retryAuth: false });
  setAuthToken(res.token);
  return res;
}

export function logout(): Promise<void> {
  // Drop the access token before the request (the server identifies the
  // session by its refresh cookie), so nothing that finishes later can wipe a
  // newer sign-in.
  clearAuthToken();
  // The account is also signed out of closed tabs; tabs still open keep theirs.
  pendingLogout = otherOpenTabs()
    .then((openTabs) =>
      request('/auth/logout/', { method: 'POST', body: JSON.stringify({ openTabs }) }, { retryAuth: false }),
    )
    .then(
      () => undefined,
      () => undefined,
    );
  return pendingLogout;
}

/**
 * Ask the backend to email a password-reset link. Resolves on success; the
 * backend intentionally returns 200 even for unknown emails (no enumeration).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await request('/auth/password-reset/', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }, { retryAuth: false });
}

/**
 * Check an activation or reset link before showing its form. Resolves with the
 * kind of link; a link that can no longer be used rejects (see
 * `isInvalidPasswordLink`).
 */
export async function checkPasswordLink(uid: string, token: string): Promise<PasswordLinkKind> {
  const res = await request<{ kind: PasswordLinkKind }>('/auth/password-reset/confirm/', {
    method: 'POST',
    body: JSON.stringify({ uid, token, dryRun: true }),
  }, { retryAuth: false });
  return res.kind;
}

/** True when the backend says an activation or reset link has expired or was already used. */
export function isInvalidPasswordLink(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.status !== 400) return false;
  const body = err.body;
  return typeof body === 'object' && body !== null && (body as { code?: unknown }).code === 'invalid_link';
}

/** Set a password using the uid + token from an activation or reset email link. */
export async function confirmPasswordReset(
  uid: string,
  token: string,
  newPassword: string,
): Promise<void> {
  await request('/auth/password-reset/confirm/', {
    method: 'POST',
    body: JSON.stringify({ uid, token, new_password: newPassword }),
  }, { retryAuth: false });
  clearAuthToken();
}

/** Fetch the currently authenticated user with the in-memory access token. */
export async function getCurrentUser(): Promise<DemoUser> {
  return request<DemoUser>('/auth/me/');
}

export async function restoreSession(): Promise<DemoUser | null> {
  let token = await refreshAuthToken();
  // Two pages renewing one refresh cookie together (a duplicated tab, or a
  // browser that sends no tab name): the first rotates it and the other is
  // refused. The winner's response leaves the new cookie in the browser, so
  // one retry a moment later picks it up.
  if (!token && onPortalPage()) {
    await delay(400);
    token = await refreshAuthToken();
  }
  if (!token) return null;

  try {
    return await getCurrentUser();
  } catch {
    clearAuthToken();
    return null;
  }
}

/**
 * Change the signed-in user's password (the backend verifies the current one).
 * Resolves `false` when the user signed out or another session replaced this
 * one while the request was in flight; the new token is then discarded.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const sessionVersion = getAuthSessionVersion();
  const res = await request<{ token: string }>('/auth/me/change-password/', {
    method: 'POST',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
  if (getAuthSessionVersion() !== sessionVersion) return false;
  setAuthToken(res.token);
  return true;
}
