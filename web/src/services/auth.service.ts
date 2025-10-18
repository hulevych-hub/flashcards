import { Injectable } from '@angular/core';

const AUTH_KEY = 'auth.login';   // stores the *full* header: "Basic abcd..."
const EXP_KEY  = 'auth.exp';     // epoch ms
const EXP_MIN  = 60;             // sliding

@Injectable({ providedIn: 'root' })
export class AuthService {
  /** Return the full Authorization header value ("Basic abcd...") or null */
  getAuthHeader(): string | null {
    const v = localStorage.getItem(AUTH_KEY);
    return v ? v : null;
  }

  /** Return just the base64 credentials without the "Basic " prefix, or null */
  getBasic(): string | null {
    const v = localStorage.getItem(AUTH_KEY);
    if (!v) return null;
    return v.startsWith('Basic ') ? v.slice(6) : v; // tolerate older saved format
  }

  /** Save the full header ("Basic abcd...") and start/refresh the 15-min window */
  saveAuthHeader(fullHeader: string) {
    localStorage.setItem(AUTH_KEY, fullHeader.startsWith('Basic ') ? fullHeader : `Basic ${fullHeader}`);
    this.touch();
  }

  /** Convenience: accept *base64 only* (username:password) and save as full header */
  loginWithBasic(b64: string) {
    this.saveAuthHeader(`Basic ${b64}`);
  }

  /** Extend session 15 minutes from now (called by activity + each request) */
  touch() {
    const exp = Date.now() + EXP_MIN * 60_000;
    localStorage.setItem(EXP_KEY, String(exp));
  }

  /** Read current expiration timestamp (ms) */
  getExpiration(): number | null {
    const raw = localStorage.getItem(EXP_KEY);
    return raw ? Number(raw) : null;
  }

  /** Alias for legacy callers; same as getExpiration() */
  dumbExpiry(): number | null {
    return this.getExpiration();
  }

  /** Is there a valid header and has it not expired yet? */
  isLoggedIn(): boolean {
    const hasAuth = !!this.getAuthHeader();
    const exp = this.getExpiration();
    return hasAuth && !!exp && Date.now() < exp;
  }

  /** Has the sliding window expired? */
  hasExpired(): boolean {
    const exp = this.getExpiration();
    return !!exp && Date.now() >= exp;
  }

  /** Clear everything */
  clearCredentials() {
    try {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(EXP_KEY);
      localStorage.clear();
    } catch {}
  }

  /** Friendly name used by some code paths */
  logout() {
    this.clearCredentials();
  }
}