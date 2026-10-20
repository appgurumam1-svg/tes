import { setAuthTokenProvider } from './api';

/**
 * Klien Neon Auth (Managed Better Auth) lewat REST standar.
 * Cookie sesi bersifat SameSite=None; Partitioned, jadi `credentials: "include"`
 * diperlukan pada setiap panggilan.
 */
const RAW_AUTH_URL = (import.meta.env.VITE_NEON_AUTH_URL as string | undefined)?.trim() ?? '';
const AUTH_URL = RAW_AUTH_URL.replace(/\/+$/, '');

export const authEnabled = AUTH_URL.length > 0 && import.meta.env.MODE !== 'test';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'Email atau password salah.',
  USER_ALREADY_EXISTS: 'Email ini sudah terdaftar. Coba masuk.',
  USER_NOT_FOUND: 'Akun tidak ditemukan.',
  PASSWORD_TOO_SHORT: 'Password minimal 8 karakter.',
  INVALID_EMAIL: 'Format email tidak valid.',
  EMAIL_NOT_VERIFIED: 'Email belum diverifikasi.',
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${AUTH_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new AuthError('Tidak bisa menghubungi server autentikasi.');
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const code =
      payload && typeof payload === 'object' && 'code' in payload
        ? String((payload as { code: unknown }).code)
        : '';
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : `Autentikasi gagal (HTTP ${response.status}).`;
    throw new AuthError(ERROR_MESSAGES[code] ?? message);
  }

  return payload as T;
}

export async function signUp(
  email: string,
  password: string,
  name: string,
): Promise<AuthUser> {
  const result = await call<{ user?: AuthUser }>('/sign-up/email', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
  if (!result?.user) throw new AuthError('Pendaftaran gagal.');
  return result.user;
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const result = await call<{ user?: AuthUser }>('/sign-in/email', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!result?.user) throw new AuthError('Email atau password salah.');
  return result.user;
}

export async function signOut(): Promise<void> {
  try {
    await call('/sign-out', { method: 'POST', body: '{}' });
  } catch {
    // Sesi lokal tetap dibersihkan walau request gagal.
  }
}

export async function getSession(): Promise<AuthUser | null> {
  if (!authEnabled) return null;
  try {
    const result = await call<{ user?: AuthUser } | null>('/get-session');
    return result?.user ?? null;
  } catch {
    return null;
  }
}

let cached: { token: string; expiresAt: number } | null = null;

function tokenExpiry(token: string): number {
  try {
    const payload = token.split('.')[1] ?? '';
    const json = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
    ) as { exp?: number };
    return typeof json.exp === 'number' ? json.exp * 1000 : Date.now() + 5 * 60_000;
  } catch {
    return Date.now() + 5 * 60_000;
  }
}

/** JWT 15 menit dari Neon Auth, di-cache sampai 1 menit sebelum kedaluwarsa. */
export async function getIdToken(): Promise<string | null> {
  if (!authEnabled) return null;
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;

  try {
    const result = await call<{ token?: string }>('/token');
    const token = result?.token ?? null;
    if (!token) return null;
    cached = { token, expiresAt: tokenExpiry(token) };
    return token;
  } catch {
    cached = null;
    return null;
  }
}

export function clearAuthCache(): void {
  cached = null;
}

if (authEnabled) {
  setAuthTokenProvider(getIdToken);
}
