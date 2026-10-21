import type { Attachment, HistoryEntry, Schedule } from '../types';

/**
 * Saat `VITE_API_URL` diisi (hasil `neon deploy`), aplikasi memakai Postgres
 * lewat Neon Function. Tanpa variabel itu (dan saat unit test) aplikasi
 * memakai localStorage seperti sebelumnya.
 */
const RAW_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? '';

export const API_BASE = RAW_BASE.replace(/\/+$/, '');
export const remoteEnabled = API_BASE.length > 0 && import.meta.env.MODE !== 'test';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let tokenProvider: (() => Promise<string | null>) | null = null;

/** Dipasang oleh modul auth supaya setiap request membawa Bearer JWT. */
export function setAuthTokenProvider(provider: (() => Promise<string | null>) | null): void {
  tokenProvider = provider;
}

async function authHeaders(): Promise<Record<string, string>> {
  if (!tokenProvider) return {};
  try {
    const token = await tokenProvider();
    return token ? { authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function parse<T>(response: Response): Promise<T> {
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
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Permintaan gagal (HTTP ${response.status}).`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = {
    'content-type': 'application/json',
    ...(await authHeaders()),
    ...(init?.headers ?? {}),
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('Tidak bisa menghubungi server Neon. Cek koneksi internet.');
  }

  return parse<T>(response);
}

export interface HealthResponse {
  ok: boolean;
  database: string;
  time?: string;
  error?: string;
}

export const scheduleApi = {
  health: () => request<HealthResponse>('/health'),

  list: () => request<{ schedules: Schedule[] }>('/schedules').then((r) => r.schedules),

  create: (schedule: Schedule) =>
    request<{ schedule: Schedule }>('/schedules', {
      method: 'POST',
      body: JSON.stringify(schedule),
    }).then((r) => r.schedule),

  update: (schedule: Schedule) =>
    request<{ schedule: Schedule }>(`/schedules/${encodeURIComponent(schedule.id)}`, {
      method: 'PUT',
      body: JSON.stringify(schedule),
    }).then((r) => r.schedule),

  remove: (id: string) =>
    request<{ ok: boolean }>(`/schedules/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  log: (id: string, entry: Omit<HistoryEntry, 'id'>) =>
    request<{ schedule: Schedule; entry: HistoryEntry }>(
      `/schedules/${encodeURIComponent(id)}/logs`,
      { method: 'POST', body: JSON.stringify(entry) },
    ),

  replaceAll: (schedules: Schedule[]) =>
    request<{ schedules: Schedule[] }>('/schedules', {
      method: 'PUT',
      body: JSON.stringify({ schedules }),
    }).then((r) => r.schedules),

  upload: async (file: File): Promise<Attachment> => {
    const form = new FormData();
    form.append('file', file);

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/uploads`, {
        method: 'POST',
        body: form,
        headers: await authHeaders(),
      });
    } catch {
      throw new ApiError('Tidak bisa mengunggah lampiran.');
    }

    return parse<Attachment>(response);
  },

  attachmentUrl: (key: string) =>
    request<{ url: string; expiresIn: number }>(
      `/uploads/signed?key=${encodeURIComponent(key)}`,
    ).then((r) => r.url),

  deleteAttachment: (key: string) =>
    request<{ ok: boolean; references: number }>(
      `/uploads?key=${encodeURIComponent(key)}`,
      { method: 'DELETE' },
    ),

  subscribePush: (subscription: PushSubscriptionJSON) =>
    request<{ ok: boolean }>('/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription }),
    }),

  unsubscribePush: (endpoint: string) =>
    request<{ ok: boolean }>(`/push/unsubscribe?endpoint=${encodeURIComponent(endpoint)}`, {
      method: 'DELETE',
    }),
};
