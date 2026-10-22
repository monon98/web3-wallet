/** Web 端 Bearer 会话的 sessionStorage 读写（仅存服务端签发的 token，不含私钥）。 */

export const AUTH_SESSION_STORAGE_KEY = 'plugin.web.authSessionToken';

export function readAuthSessionToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
}

export function writeAuthSessionToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, token);
}

export function clearAuthSessionToken(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}
