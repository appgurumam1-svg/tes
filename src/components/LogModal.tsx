import { useMemo, useState, type FormEvent } from 'react';
import {
  addIntervalISO,
  addMonthsISO,
  daysBetweenISO,
  formatDateID,
  isISODate,
  parseISO,
  parseNumber,
} from '../lib/date';
import { scheduleApi, remoteEnabled } from '../lib/api';
import { UNIT_LABEL, referenceDate } from '../lib/schedule';
import type { LogEntryDraft, Schedule } from '../types';
import { CalendarIcon } from './Icons';

interface LogModalProps {
  schedule: Schedule;
  today: string;
  onSubmit: (draft: LogEntryDraft) => void;
  onCancel: () => void;
}

function defaultRenewalDate(schedule: Schedule, today: string): string {
  if (!schedule.dueDate) return addMonthsISO(today, 12);

  const ref = referenceDate(schedule);
  let cycleMonths = 12;
  if (ref && schedule.history.length > 0) {
    const a = parseISO(ref);
    const b = parseISO(schedule.dueDate);
    const months = (b.y - a.y) * 12 + (b.m - a.m);
    if (months >= 12 && months % 12 === 0) cycleMonths = Math.min(months, 120);
  }
  return addMonthsISO(schedule.dueDate, cycleMonths);
}

export function LogModal({ schedule, today, onSubmit, onCancel }: LogModalProps) {
  const isFixed = schedule.kind === 'fixed';
  const [date, setDate] = useState(today);
  const [nextDue, setNextDue] = useState(() => defaultRenewalDate(schedule, today));
  const [cost, setCost] = useState(schedule.cost ? String(schedule.cost) : '');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewNext = useMemo(() => {
    if (!isISODate(date)) return null;
    if (isFixed) {
      return isISODate(nextDue) ? nextDue : null;
    }
    const value = schedule.intervalValue ?? 0;
    if (value <= 0) return null;
    return addIntervalISO(date, value, schedule.intervalUnit ?? 'month');
  }, [date, isFixed, nextDue, schedule.intervalUnit, schedule.intervalValue]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isISODate(date)) {
      setError('Tanggal tidak valid.');
      return;
    }
    if (isFixed) {
      if (!isISODate(nextDue)) {
        setError('Tanggal berlaku baru tidak valid.');
        return;
      }
      if (daysBetweenISO(date, nextDue) <= 0) {
        setError('Tanggal berlaku baru harus setelah tanggal perpanjangan.');
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      const attachment = file ? await scheduleApi.upload(file) : undefined;
      onSubmit({
        date,
        cost: parseNumber(cost),
        note: note.trim() || undefined,
        nextDueDate: isFixed ? nextDue : undefined,
        attachment,
      });
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : 'Gagal mengunggah lampiran.',
      );
    } finally {
      setBusy(false);
    }
  }

  const previewDays = previewNext ? daysBetweenISO(today, previewNext) : null;

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className={`callout ${isFixed ? 'callout--info' : 'callout--muted'}`}>
        <CalendarIcon size={18} />
        <div>
          {isFixed ? (
            <>
              <strong>Berlaku sampai {schedule.dueDate ? formatDateID(schedule.dueDate) : '—'}</strong>
              <span>Masukkan tanggal masa berlaku yang baru setelah diperpanjang.</span>
            </>
          ) : (
            <>
              <strong>
                Terakhir: {schedule.lastDoneDate ? formatDateID(schedule.lastDoneDate) : '—'}
              </strong>
              <span>
                Diulang tiap {schedule.intervalValue}{' '}
                {UNIT_LABEL[schedule.intervalUnit ?? 'month']}.
              </span>
            </>
          )}
        </div>
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="log-date">
            {isFixed ? 'Tanggal perpanjangan' : 'Tanggal dilakukan'}
          </label>
          <input
            id="log-date"
            type="date"
            className="input"
            value={date}
            max={isFixed ? undefined : today}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>

        {isFixed ? (
          <div className="field">
            <label htmlFor="log-next-due">Berlaku sampai (baru)</label>
            <input
              id="log-next-due"
              type="date"
              className="input"
              value={nextDue}
              onChange={(event) => setNextDue(event.target.value)}
            />
          </div>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="log-cost">Biaya aktual</label>
        <div className="input-with-prefix">
          <span>Rp</span>
          <input
            id="log-cost"
            type="number"
            min={0}
            step={1000}
            className="input"
            placeholder="opsional"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="log-note">Catatan</label>
        <textarea
          id="log-note"
          className="input"
          rows={2}
          placeholder={isFixed ? 'Contoh: bayar di Samsat, dapat STNK baru' : 'Contoh: oli Shell 800 ml'}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      {remoteEnabled ? (
        <div className="field">
          <label htmlFor="log-attachment">Lampiran (opsional)</label>
          <input
            id="log-attachment"
            type="file"
            className="input input--file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <p className="hint">
            Struk atau foto, maksimal 8 MB. Disimpan privat di Neon Object Storage.
          </p>
        </div>
      ) : null}

      {previewNext && previewDays !== null ? (
        <div className="preview preview--safe">
          <span className="preview__label">Jatuh tempo berikutnya</span>
          <strong>{formatDateID(previewNext)}</strong>
          <span className="preview__meta">
            {previewDays < 0
              ? `${Math.abs(previewDays)} hari lalu`
              : previewDays === 0
                ? 'hari ini'
                : `${previewDays} hari lagi`}
          </span>
        </div>
      ) : null}

      {error ? <p className="form__error">{error}</p> : null}

      <div className="form__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Batal
        </button>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Menyimpan…' : 'Simpan catatan'}
        </button>
      </div>
    </form>
  );
}
