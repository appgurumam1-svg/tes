import { formatDateID, formatDuration, formatRupiah } from '../lib/date';
import {
  CATEGORY_META,
  STATUS_LABEL,
  computeSchedule,
  countdown,
  describeInterval,
  referenceDate,
} from '../lib/schedule';
import type { Schedule } from '../types';
import { AlertIcon, CheckIcon, PencilIcon, TrashIcon } from './Icons';

interface ScheduleCardProps {
  schedule: Schedule;
  today: string;
  onLog: (schedule: Schedule) => void;
  onEdit: (schedule: Schedule) => void;
  onDelete: (schedule: Schedule) => void;
}

export function ScheduleCard({ schedule, today, onLog, onEdit, onDelete }: ScheduleCardProps) {
  const computed = computeSchedule(schedule, today);
  const { value, caption } = countdown(computed);
  const category = CATEGORY_META[schedule.category];
  const percent = Math.round(computed.progress * 100);
  const ref = referenceDate(schedule);
  const lastHistory = schedule.history[0];

  const elapsedText =
    schedule.kind === 'interval' && computed.elapsed && ref
      ? `Sudah ${formatDuration(computed.elapsed)} sejak ${formatDateID(ref, { short: true })}`
      : lastHistory?.date
        ? `Terakhir diperpanjang ${formatDateID(lastHistory.date, { short: true })}`
        : 'Belum ada riwayat perpanjangan';

  return (
    <article className={`card card--${computed.status}`}>
      <div className="card__top">
        <span className="card__emoji" aria-hidden="true">
          {category.emoji}
        </span>
        <div className="card__heading">
          <h3 className="card__title" title={schedule.title}>
            {schedule.title}
          </h3>
          <p className="card__sub">
            {category.label} · {describeInterval(schedule)}
          </p>
        </div>
        <span className={`badge badge--${computed.status}`}>
          {computed.status === 'overdue' ? <AlertIcon size={13} /> : null}
          {computed.status === 'safe' ? <CheckIcon size={13} /> : null}
          {STATUS_LABEL[computed.status]}
        </span>
      </div>

      <div className={`countdown countdown--${computed.status}`}>
        <span className="countdown__value">{value}</span>
        <span className="countdown__caption">{caption}</span>
      </div>

      <div
        className="progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`Pemakaian interval ${percent}%`}
      >
        <span
          className={`progress__bar progress__bar--${computed.status}`}
          style={{ width: `${Math.max(percent, 2)}%` }}
        />
      </div>

      <dl className="card__facts">
        <div>
          <dt>{schedule.kind === 'interval' ? 'Terakhir' : 'Berlaku sejak'}</dt>
          <dd>{ref ? formatDateID(ref) : '—'}</dd>
        </div>
        <div>
          <dt>{schedule.kind === 'interval' ? 'Jatuh tempo' : 'Kedaluwarsa'}</dt>
          <dd>{computed.dueDate ? formatDateID(computed.dueDate) : '—'}</dd>
        </div>
      </dl>

      <p className="card__elapsed">{elapsedText}</p>

      {schedule.note ? <p className="card__note">{schedule.note}</p> : null}

      <div className="card__footer">
        {schedule.cost ? (
          <span className="chip chip--muted">Estimasi {formatRupiah(schedule.cost)}</span>
        ) : (
          <span />
        )}
        <div className="card__actions">
          <button type="button" className="icon-btn" onClick={() => onEdit(schedule)} title="Edit">
            <PencilIcon size={16} />
            <span className="sr-only">Edit</span>
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            onClick={() => onDelete(schedule)}
            title="Hapus"
          >
            <TrashIcon size={16} />
            <span className="sr-only">Hapus</span>
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => onLog(schedule)}>
            {schedule.kind === 'interval' ? 'Catat servis' : 'Perpanjang'}
          </button>
        </div>
      </div>
    </article>
  );
}
