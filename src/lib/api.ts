import type { HistoryEntry, Schedule } from '../types';

/**
 * Saat `VITE_API_URL` diisi (hasil `neon deploy`), aplikasi memakai Postgres
 * lewat Neon Function. Tanpa variabel itu (dan saat unit test) aplikasi
 * memakai localStorage seperti sebelumnya.
 */
const RAW_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? '';

export const API_BASE = RAW_BASE.replace(/\/+$/, '');
export const remoteEnabled = API_BASE.length > 0 && import.meta.env.MODE !== 'test';

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError('Tidak bisa menghubungi server Neon. Cek koneksi internet.');
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
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Permintaan gagal (HTTP ${response.status}).`;
    throw new ApiError(message);
  }

  return payload as T;
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
};
