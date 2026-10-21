import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { HistoryList } from './components/HistoryList';
import { LogModal } from './components/LogModal';
import { Modal } from './components/Modal';
import { ScheduleCard } from './components/ScheduleCard';
import { ScheduleForm } from './components/ScheduleForm';
import {
  BellIcon,
  CalendarIcon,
  CheckIcon,
  DownloadIcon,
  LogOutIcon,
  PlusIcon,
  SearchIcon,
  UploadIcon,
} from './components/Icons';
import { formatDateID, todayISO } from './lib/date';
import { ApiError, remoteEnabled, scheduleApi } from './lib/api';
import {
  authEnabled,
  clearAuthCache,
  getSession,
  signOut,
  type AuthUser,
} from './lib/auth';
import { AuthScreen } from './components/AuthScreen';
import { ThemeToggle } from './components/ThemeToggle';
import { PushToggle } from './components/PushToggle';
import { VerifyEmailForm } from './components/VerifyEmailForm';
import { CATEGORY_META, computeSchedule, sortByUrgency, summarize } from './lib/schedule';
import { createSeedSchedules } from './lib/seed';
import {
  downloadFile,
  exportSchedules,
  importSchedules,
  loadSchedules,
  saveSchedules,
  uid,
} from './lib/storage';
import type {
  Category,
  Filters,
  HistoryEntry,
  LogEntryDraft,
  Schedule,
  ScheduleDraft,
} from './types';

type EditorState = { mode: 'create' } | { mode: 'edit'; schedule: Schedule } | null;

const STATUS_TABS: { key: Filters['status']; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'overdue', label: 'Terlambat' },
  { key: 'soon', label: 'Segera' },
  { key: 'safe', label: 'Aman' },
];

const EMPTY_FILTERS: Filters = { search: '', status: 'all', category: 'all' };

function applyDraft(item: Schedule, draft: ScheduleDraft, now: string): Schedule {
  const isInterval = draft.kind === 'interval';
  return {
    ...item,
    ...draft,
    lastDoneDate: isInterval ? draft.lastDoneDate ?? item.lastDoneDate : undefined,
    intervalValue: isInterval ? draft.intervalValue : undefined,
    intervalUnit: isInterval ? draft.intervalUnit : undefined,
    dueDate: isInterval ? undefined : draft.dueDate,
    updatedAt: now,
  };
}

export default function App() {
  const [schedules, setSchedules] = useState<Schedule[]>(() =>
    remoteEnabled ? [] : (loadSchedules() ?? createSeedSchedules()),
  );
  const [today, setToday] = useState(todayISO());
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [editor, setEditor] = useState<EditorState>(null);
  const [logTarget, setLogTarget] = useState<Schedule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(remoteEnabled);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(authEnabled);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bootstrapped = useRef<string | null>(null);

  // Sesi Neon Auth (cookie) dimuat sekali saat aplikasi dibuka.
  useEffect(() => {
    if (!authEnabled) return;
    let cancelled = false;
    void getSession().then((sessionUser) => {
      if (cancelled) return;
      setUser(sessionUser);
      setAuthLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (remoteEnabled) return;
    saveSchedules(schedules);
  }, [schedules]);

  // Muat data dari Neon Postgres lewat Neon Function (sekali per sesi/user).
  useEffect(() => {
    const key = authEnabled ? user?.id ?? null : 'anon';
    if (!remoteEnabled || (authEnabled && !user) || bootstrapped.current === key) return;
    bootstrapped.current = key;
    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const list = await scheduleApi.list();
        if (cancelled) return;

        if (list.length === 0) {
          const seeds = createSeedSchedules(todayISO());
          const saved = await scheduleApi.replaceAll(seeds);
          if (!cancelled) setSchedules(saved);
        } else {
          setSchedules(list);
        }
        setSyncError(null);
      } catch (error) {
        if (!cancelled) {
          setSyncError(
            error instanceof Error ? error.message : 'Gagal memuat data dari Neon.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const refresh = () => setToday(todayISO());
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const stats = useMemo(() => summarize(schedules, today), [schedules, today]);

  const visible = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const filtered = schedules.filter((schedule) => {
      if (filters.category !== 'all' && schedule.category !== filters.category) return false;
      if (filters.status !== 'all' && computeSchedule(schedule, today).status !== filters.status) {
        return false;
      }
      if (!query) return true;
      const haystack = `${schedule.title} ${schedule.note ?? ''} ${
        CATEGORY_META[schedule.category].label
      }`.toLowerCase();
      return haystack.includes(query);
    });
    return sortByUrgency(filtered, today);
  }, [schedules, filters, today]);

  function reportSyncError(error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      clearAuthCache();
      bootstrapped.current = null;
      setUser(null);
      setSyncError('Sesi kamu berakhir. Silakan masuk lagi.');
      return;
    }
    const message = error instanceof Error ? error.message : 'Gagal menyimpan ke Neon.';
    setSyncError(message);
    setToast(message);
  }

  async function handleSignOut() {
    await signOut();
    clearAuthCache();
    bootstrapped.current = null;
    setUser(null);
    setSchedules([]);
    setSyncError(null);
    setLoading(Boolean(remoteEnabled));
  }

  async function handleDeleteAttachment(scheduleId: string, key: string) {
    try {
      await scheduleApi.deleteAttachment(key);
      setSchedules((prev) =>
        prev.map((item) =>
          item.id === scheduleId
            ? {
                ...item,
                history: item.history.map((entry) =>
                  entry.attachment?.key === key ? { ...entry, attachment: undefined } : entry,
                ),
              }
            : item,
        ),
      );
      setSyncError(null);
      setToast('Lampiran dihapus.');
    } catch (error) {
      reportSyncError(error);
    }
  }

  async function handleSubmitDraft(draft: ScheduleDraft) {
    const now = new Date().toISOString();

    if (editor?.mode === 'edit') {
      const target = editor.schedule;
      const updated = applyDraft(target, draft, now);
      setSchedules((prev) => prev.map((item) => (item.id === target.id ? updated : item)));
      setToast('Perubahan disimpan.');
      setEditor(null);

      if (remoteEnabled) {
        try {
          const saved = await scheduleApi.update(updated);
          setSchedules((prev) => prev.map((item) => (item.id === saved.id ? saved : item)));
          setSyncError(null);
        } catch (error) {
          reportSyncError(error);
        }
      }
      return;
    }

    const created: Schedule = {
      ...draft,
      id: uid('sched'),
      history: [],
      createdAt: now,
      updatedAt: now,
    };
    setSchedules((prev) => [created, ...prev]);
    setToast('Jadwal baru ditambahkan.');
    setEditor(null);

    if (remoteEnabled) {
      try {
        const saved = await scheduleApi.create(created);
        setSchedules((prev) => prev.map((item) => (item.id === created.id ? saved : item)));
        setSyncError(null);
      } catch (error) {
        reportSyncError(error);
      }
    }
  }

  async function handleLog(draft: LogEntryDraft) {
    if (!logTarget) return;
    const target = logTarget;

    const entry: HistoryEntry = {
      id: uid('hist'),
      date: draft.date,
      cost: draft.cost,
      note: draft.note,
      nextDueDate: draft.nextDueDate,
    };

    const optimistic: Schedule = {
      ...target,
      history: [entry, ...target.history],
      updatedAt: new Date().toISOString(),
      ...(target.kind === 'interval'
        ? { lastDoneDate: draft.date }
        : { dueDate: draft.nextDueDate ?? target.dueDate }),
    };

    setSchedules((prev) => prev.map((item) => (item.id === target.id ? optimistic : item)));
    setLogTarget(null);
    setToast(`Tercatat: ${target.title}.`);

    if (remoteEnabled) {
      try {
        const { schedule } = await scheduleApi.log(target.id, {
          date: draft.date,
          cost: draft.cost,
          note: draft.note,
          nextDueDate: draft.nextDueDate,
          attachment: draft.attachment,
        });
        setSchedules((prev) => prev.map((item) => (item.id === schedule.id ? schedule : item)));
        setSyncError(null);
      } catch (error) {
        reportSyncError(error);
      }
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setSchedules((prev) => prev.filter((item) => item.id !== target.id));
    setToast(`"${target.title}" dihapus.`);
    setDeleteTarget(null);

    if (remoteEnabled) {
      try {
        await scheduleApi.remove(target.id);
        setSyncError(null);
      } catch (error) {
        setSchedules((prev) =>
          prev.some((item) => item.id === target.id) ? prev : [...prev, target],
        );
        reportSyncError(error);
      }
    }
  }

  function handleExport() {
    downloadFile(`tenggat-${today.replaceAll('-', '')}.json`, exportSchedules(schedules));
    setToast('Backup JSON diunduh.');
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const imported = importSchedules(await file.text());
      const next = remoteEnabled ? await scheduleApi.replaceAll(imported) : imported;
      setSchedules(next);
      setSyncError(null);
      setToast(`${next.length} jadwal berhasil diimpor.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Gagal mengimpor file.');
    }
  }

  const categoryCounts = useMemo(() => {
    const counts = new Map<Category, number>();
    for (const schedule of schedules) {
      counts.set(schedule.category, (counts.get(schedule.category) ?? 0) + 1);
    }
    return counts;
  }, [schedules]);

  function setStatusFilter(status: Filters['status']) {
    setFilters((prev) => ({ ...prev, status }));
  }

  if (authEnabled && authLoading) {
    return (
      <div className="auth">
        <div className="auth__card auth__card--center">
          <span className="brand__mark" aria-hidden="true">
            <BellIcon size={19} />
          </span>
          <p className="auth__lead">Memeriksa sesi…</p>
        </div>
      </div>
    );
  }

  if (authEnabled && !user) {
    return (
      <AuthScreen
        onAuthenticated={(nextUser) => {
          setSyncError(null);
          setUser(nextUser);
        }}
      />
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__inner">
          <div className="brand">
            <span className="brand__mark" aria-hidden="true">
              <BellIcon size={19} />
            </span>
            <div className="brand__text">
              <strong>Tenggat</strong>
              <span>Pengingat servis &amp; masa berlaku</span>
            </div>
          </div>
          <div className="topbar__actions">
            <PushToggle />
            <ThemeToggle />
            {authEnabled && user ? (
              <div className="user-chip">
                <span className="user-chip__avatar" aria-hidden="true">
                  {(user.name || user.email).slice(0, 1).toUpperCase()}
                </span>
                <span className="user-chip__email">{user.email}</span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={handleSignOut}
                  title="Keluar"
                >
                  <LogOutIcon size={16} />
                  <span className="sr-only">Keluar</span>
                </button>
              </div>
            ) : null}
            <span
              className={`sync-pill ${remoteEnabled ? 'sync-pill--cloud' : 'sync-pill--local'}`}
              title={
                remoteEnabled
                  ? 'Tersinkron ke Neon Postgres'
                  : 'Data disimpan di localStorage browser ini'
              }
            >
              <span className="sync-pill__dot" aria-hidden="true" />
              {remoteEnabled ? 'Neon Postgres' : 'Lokal'}
            </span>
            <span className="today-pill">
              <CalendarIcon size={15} />
              {formatDateID(today, { weekday: true })}
            </span>
            <button type="button" className="icon-btn" onClick={handleExport} title="Ekspor JSON">
              <DownloadIcon size={17} />
              <span className="sr-only">Ekspor</span>
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Impor JSON"
            >
              <UploadIcon size={17} />
              <span className="sr-only">Impor</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={handleImport}
            />
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setEditor({ mode: 'create' })}
            >
              <PlusIcon size={16} />
              Tambah jadwal
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        {authEnabled && user && user.emailVerified === false ? (
          <div className="banner banner--warn" role="status">
            <strong>Email belum diverifikasi.</strong>
            <span>{user.email}</span>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setVerifyOpen(true)}
            >
              Verifikasi email
            </button>
          </div>
        ) : null}

        {syncError ? (
          <div className="banner banner--error" role="alert">
            <strong>Gagal sinkron ke Neon.</strong>
            <span>{syncError}</span>
          </div>
        ) : null}

        <section className="hero">
          <div className="hero__copy">
            <p className="eyebrow">Catat sekali, ingat selamanya</p>
            <h1>
              Jangan sampai <em>telat</em> lagi.
            </h1>
            <p className="hero__lead">
              Ganti oli, perpanjang SIM, bayar pajak STNK — semua tercatat di satu tempat. Tenggat
              menghitung sendiri sisa hari, keterlambatan, dan sudah berapa lama sejak terakhir
              kamu melakukannya.
            </p>
          </div>
          <div className="stats">
            <button
              type="button"
              className={`stat stat--danger${filters.status === 'overdue' ? ' is-active' : ''}`}
              onClick={() => setStatusFilter('overdue')}
            >
              <span className="stat__value">{stats.overdue}</span>
              <span className="stat__label">Terlambat</span>
              <span className="stat__hint">sudah lewat tenggat</span>
            </button>
            <button
              type="button"
              className={`stat stat--warn${filters.status === 'soon' ? ' is-active' : ''}`}
              onClick={() => setStatusFilter('soon')}
            >
              <span className="stat__value">{stats.soon}</span>
              <span className="stat__label">Segera</span>
              <span className="stat__hint">dalam masa pengingat</span>
            </button>
            <button
              type="button"
              className={`stat stat--ok${filters.status === 'safe' ? ' is-active' : ''}`}
              onClick={() => setStatusFilter('safe')}
            >
              <span className="stat__value">{stats.safe}</span>
              <span className="stat__label">Aman</span>
              <span className="stat__hint">masih ada waktu</span>
            </button>
            <button
              type="button"
              className={`stat stat--neutral${filters.status === 'all' ? ' is-active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              <span className="stat__value">{stats.total}</span>
              <span className="stat__label">Total</span>
              <span className="stat__hint">jadwal terpantau</span>
            </button>
          </div>
        </section>

        <section className="toolbar" aria-label="Pencarian dan filter">
          <div className="toolbar__row">
            <div className="search">
              <SearchIcon size={17} />
              <input
                className="search__input"
                type="search"
                placeholder="Cari jadwal atau catatan…"
                aria-label="Cari jadwal"
                value={filters.search}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, search: event.target.value }))
                }
              />
            </div>
            <select
              className="input input--compact"
              aria-label="Filter kategori"
              value={filters.category}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  category: event.target.value as Filters['category'],
                }))
              }
            >
              <option value="all">Semua kategori</option>
              {(Object.keys(CATEGORY_META) as Category[]).map((key) => (
                <option key={key} value={key}>
                  {CATEGORY_META[key].emoji} {CATEGORY_META[key].label} (
                  {categoryCounts.get(key) ?? 0})
                </option>
              ))}
            </select>
          </div>

          <div className="tabs" role="tablist" aria-label="Filter status">
            {STATUS_TABS.map((tab) => {
              const count = tab.key === 'all' ? stats.total : stats[tab.key];
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={filters.status === tab.key}
                  className={`tab${filters.status === tab.key ? ' is-active' : ''}`}
                  onClick={() => setStatusFilter(tab.key)}
                >
                  {tab.label}
                  <span className="tab__count">{count}</span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="section-head">
          <h2>Jadwal kamu</h2>
          <p>
            {visible.length} dari {stats.total} jadwal · diurutkan dari yang paling mendesak
          </p>
        </div>

        {loading ? (
          <section className="empty">
            <span className="empty__emoji" aria-hidden="true">
              ⏳
            </span>
            <h2>Memuat data dari Neon…</h2>
            <p>Menghubungkan ke Postgres lewat Neon Function.</p>
          </section>
        ) : visible.length > 0 ? (
          <section className="grid">
            {visible.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                today={today}
                onLog={setLogTarget}
                onEdit={(item) => setEditor({ mode: 'edit', schedule: item })}
                onDelete={setDeleteTarget}
              />
            ))}
          </section>
        ) : (
          <section className="empty">
            <span className="empty__emoji" aria-hidden="true">
              🗓️
            </span>
            <h2>{schedules.length === 0 ? 'Belum ada jadwal' : 'Tidak ada yang cocok'}</h2>
            <p>
              {schedules.length === 0
                ? 'Tambahkan servis rutin, SIM, STNK, atau apa pun yang punya tenggat. Tenggat yang menghitung sisanya.'
                : 'Coba ubah kata kunci, kategori, atau filter status.'}
            </p>
            {schedules.length === 0 ? (
              <div className="empty__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setEditor({ mode: 'create' })}
                >
                  <PlusIcon size={16} />
                  Tambah jadwal
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setSchedules(createSeedSchedules(today));
                    setToast('Contoh jadwal dimuat.');
                  }}
                >
                  Muat contoh
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setFilters(EMPTY_FILTERS)}
              >
                Reset filter
              </button>
            )}
          </section>
        )}
      </main>

      <Modal
        open={editor !== null}
        title={editor?.mode === 'edit' ? 'Edit jadwal' : 'Jadwal baru'}
        subtitle={
          editor?.mode === 'edit' ? editor.schedule.title : 'Isi sekali, biar tidak lupa lagi.'
        }
        onClose={() => setEditor(null)}
        size="lg"
      >
        {editor ? (
          <>
            <ScheduleForm
              key={editor.mode === 'edit' ? editor.schedule.id : 'new'}
              initial={editor.mode === 'edit' ? editor.schedule : undefined}
              today={today}
              onSubmit={handleSubmitDraft}
              onCancel={() => setEditor(null)}
            />
            {editor.mode === 'edit' ? (
              <HistoryList
                schedule={
                  schedules.find((item) => item.id === editor.schedule.id) ?? editor.schedule
                }
                onDeleteAttachment={(key) =>
                  void handleDeleteAttachment(editor.schedule.id, key)
                }
              />
            ) : null}
          </>
        ) : null}
      </Modal>

      <Modal
        open={logTarget !== null}
        title={logTarget?.kind === 'fixed' ? 'Perpanjang masa berlaku' : 'Catat servis'}
        subtitle={logTarget?.title}
        onClose={() => setLogTarget(null)}
      >
        {logTarget ? (
          <LogModal
            key={logTarget.id}
            schedule={logTarget}
            today={today}
            onSubmit={handleLog}
            onCancel={() => setLogTarget(null)}
          />
        ) : null}
      </Modal>

      <Modal
        open={verifyOpen}
        title="Verifikasi email"
        subtitle={user?.email}
        onClose={() => setVerifyOpen(false)}
      >
        {user ? (
          <VerifyEmailForm
            email={user.email}
            onCancel={() => setVerifyOpen(false)}
            onVerified={() => {
              void getSession().then((refreshed) => {
                setUser(refreshed ?? { ...user, emailVerified: true });
              });
              setVerifyOpen(false);
              setToast('Email berhasil diverifikasi.');
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={deleteTarget !== null}
        title="Hapus jadwal?"
        subtitle={deleteTarget?.title}
        onClose={() => setDeleteTarget(null)}
      >
        <p className="confirm-text">
          Riwayat untuk jadwal ini juga akan dihapus. Tindakan ini tidak bisa dibatalkan.
        </p>
        <div className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={() => setDeleteTarget(null)}>
            Batal
          </button>
          <button type="button" className="btn btn--danger" onClick={handleDelete}>
            Ya, hapus
          </button>
        </div>
      </Modal>

      {toast ? (
        <div className="toast" role="status">
          <CheckIcon size={16} />
          {toast}
        </div>
      ) : null}
    </div>
  );
}
