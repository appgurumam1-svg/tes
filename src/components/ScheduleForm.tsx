import { useMemo, useState, type FormEvent } from 'react';
import {
  addIntervalISO,
  addMonthsISO,
  daysBetweenISO,
  formatDateID,
  isISODate,
  parseNumber,
} from '../lib/date';
import { STATUS_LABEL, UNIT_LABEL } from '../lib/schedule';
import type {
  Category,
  CategoryItem,
  IntervalUnit,
  Schedule,
  ScheduleDraft,
  ScheduleKind,
} from '../types';

interface ScheduleFormProps {
  initial?: Schedule;
  categories: CategoryItem[];
  today: string;
  onSubmit: (draft: ScheduleDraft) => void;
  onCancel: () => void;
}

const UNIT_OPTIONS: IntervalUnit[] = ['day', 'week', 'month', 'year'];

const PRESETS: { label: string; value: number; unit: IntervalUnit }[] = [
  { label: '1 bulan', value: 1, unit: 'month' },
  { label: '3 bulan', value: 3, unit: 'month' },
  { label: '6 bulan', value: 6, unit: 'month' },
  { label: '1 tahun', value: 1, unit: 'year' },
];

export function ScheduleForm({
  initial,
  categories,
  today,
  onSubmit,
  onCancel,
}: ScheduleFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState<Category>(
    initial?.category ?? categories[0]?.id ?? 'lainnya',
  );
  const [kind, setKind] = useState<ScheduleKind>(initial?.kind ?? 'interval');
  const [lastDone, setLastDone] = useState(initial?.lastDoneDate ?? today);
  const [intervalValue, setIntervalValue] = useState(String(initial?.intervalValue ?? 3));
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>(
    initial?.intervalUnit ?? 'month',
  );
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? addMonthsISO(today, 12));
  const [remind, setRemind] = useState(String(initial?.remindBeforeDays ?? 30));
  const [cost, setCost] = useState(initial?.cost ? String(initial.cost) : '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    const value = Number(intervalValue);
    const remindDays = Number(remind);
    let due: string | null = null;

    if (kind === 'fixed') {
      if (isISODate(dueDate)) due = dueDate;
    } else if (isISODate(lastDone) && Number.isFinite(value) && value > 0) {
      due = addIntervalISO(lastDone, value, intervalUnit);
    }
    if (!due) return null;

    const daysLeft = daysBetweenISO(today, due);
    const status: 'overdue' | 'soon' | 'safe' =
      daysLeft < 0 ? 'overdue' : daysLeft <= remindDays ? 'soon' : 'safe';
    return { due, daysLeft, status };
  }, [kind, dueDate, lastDone, intervalValue, intervalUnit, remind, today]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Nama aktivitas wajib diisi.');
      return;
    }

    const value = Number(intervalValue);
    if (kind === 'interval') {
      if (!isISODate(lastDone)) {
        setError('Tanggal terakhir dilakukan tidak valid.');
        return;
      }
      if (!Number.isFinite(value) || value <= 0) {
        setError('Interval harus lebih dari 0.');
        return;
      }
    } else if (!isISODate(dueDate)) {
      setError('Tanggal kedaluwarsa tidak valid.');
      return;
    }

    const draft: ScheduleDraft = {
      title: cleanTitle,
      category,
      kind,
      note: note.trim() || undefined,
      remindBeforeDays: Math.min(Math.max(Math.round(Number(remind) || 0), 0), 365),
      cost: parseNumber(cost),
    };

    if (kind === 'interval') {
      draft.lastDoneDate = lastDone;
      draft.intervalValue = Math.round(value);
      draft.intervalUnit = intervalUnit;
    } else {
      draft.dueDate = dueDate;
    }

    onSubmit(draft);
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="schedule-title">Nama aktivitas</label>
        <input
          id="schedule-title"
          className="input"
          value={title}
          placeholder="Contoh: Ganti oli motor"
          onChange={(event) => setTitle(event.target.value)}
          autoFocus
          maxLength={120}
        />
      </div>

      <div className="field">
        <label htmlFor="schedule-category">Kategori</label>
        <select
          id="schedule-category"
          className="input"
          value={category}
          onChange={(event) => setCategory(event.target.value as Category)}
        >
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.emoji} {item.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="field">
        <legend>Jenis jadwal</legend>
        <div className="segmented" role="radiogroup" aria-label="Jenis jadwal">
          <button
            type="button"
            role="radio"
            aria-checked={kind === 'interval'}
            className={kind === 'interval' ? 'segmented__item is-active' : 'segmented__item'}
            onClick={() => setKind('interval')}
          >
            Berkala
            <small>diulang tiap periode</small>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={kind === 'fixed'}
            className={kind === 'fixed' ? 'segmented__item is-active' : 'segmented__item'}
            onClick={() => setKind('fixed')}
          >
            Tanggal tetap
            <small>punya masa berlaku</small>
          </button>
        </div>
      </fieldset>

      {kind === 'interval' ? (
        <>
          <div className="field">
            <label htmlFor="schedule-last">Terakhir dilakukan</label>
            <input
              id="schedule-last"
              type="date"
              className="input"
              value={lastDone}
              max={today}
              onChange={(event) => setLastDone(event.target.value)}
            />
            <p className="hint">Tanggal servis/penggantian terakhir. Hari ini juga boleh.</p>
          </div>

          <div className="field">
            <label htmlFor="schedule-interval">Diulang setiap</label>
            <div className="row">
              <input
                id="schedule-interval"
                type="number"
                min={1}
                max={999}
                className="input input--number"
                value={intervalValue}
                onChange={(event) => setIntervalValue(event.target.value)}
              />
              <select
                className="input"
                aria-label="Satuan interval"
                value={intervalUnit}
                onChange={(event) => setIntervalUnit(event.target.value as IntervalUnit)}
              >
                {UNIT_OPTIONS.map((unit) => (
                  <option key={unit} value={unit}>
                    {UNIT_LABEL[unit]}
                  </option>
                ))}
              </select>
            </div>
            <div className="presets">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className={
                    Number(intervalValue) === preset.value && intervalUnit === preset.unit
                      ? 'chip chip--active'
                      : 'chip'
                  }
                  onClick={() => {
                    setIntervalValue(String(preset.value));
                    setIntervalUnit(preset.unit);
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="field">
          <label htmlFor="schedule-due">Berlaku sampai</label>
          <input
            id="schedule-due"
            type="date"
            className="input"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
          <p className="hint">Tanggal kedaluwarsa sesuai dokumen (SIM, STNK, plat, dsb).</p>
        </div>
      )}

      <div className="row">
        <div className="field">
          <label htmlFor="schedule-remind">Ingatkan sebelum</label>
          <div className="input-with-suffix">
            <input
              id="schedule-remind"
              type="number"
              min={0}
              max={365}
              className="input"
              value={remind}
              onChange={(event) => setRemind(event.target.value)}
            />
            <span>hari</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor="schedule-cost">Estimasi biaya</label>
          <div className="input-with-prefix">
            <span>Rp</span>
            <input
              id="schedule-cost"
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
      </div>

      <div className="field">
        <label htmlFor="schedule-note">Catatan</label>
        <textarea
          id="schedule-note"
          className="input"
          rows={2}
          placeholder="Contoh: oli 800 ml, bengkel langganan"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      {preview ? (
        <div className={`preview preview--${preview.status}`}>
          <span className="preview__label">Jatuh tempo berikutnya</span>
          <strong>{formatDateID(preview.due)}</strong>
          <span className={`badge badge--${preview.status}`}>
            {preview.daysLeft < 0
              ? `${Math.abs(preview.daysLeft)} hari terlambat`
              : preview.daysLeft === 0
                ? 'hari ini'
                : `${preview.daysLeft} hari lagi`}
            {' · '}
            {STATUS_LABEL[preview.status]}
          </span>
        </div>
      ) : null}

      {error ? <p className="form__error">{error}</p> : null}

      <div className="form__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Batal
        </button>
        <button type="submit" className="btn btn--primary">
          {initial ? 'Simpan perubahan' : 'Tambah jadwal'}
        </button>
      </div>
    </form>
  );
}
