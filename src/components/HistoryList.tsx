import { formatDateID, formatRupiah } from '../lib/date';
import type { Schedule } from '../types';

interface HistoryListProps {
  schedule: Schedule;
}

export function HistoryList({ schedule }: HistoryListProps) {
  const total = schedule.history.reduce((sum, entry) => sum + (entry.cost ?? 0), 0);

  return (
    <section className="history">
      <header className="history__head">
        <h3>Riwayat</h3>
        {total > 0 ? <span className="chip chip--muted">Total {formatRupiah(total)}</span> : null}
      </header>

      {schedule.history.length === 0 ? (
        <p className="history__empty">
          Belum ada catatan. Gunakan tombol {schedule.kind === 'fixed' ? '"Perpanjang"' : '"Catat servis"'} untuk
          menambah riwayat pertama.
        </p>
      ) : (
        <ol className="history__list">
          {schedule.history.map((entry) => (
            <li key={entry.id} className="history__item">
              <span className="history__dot" aria-hidden="true" />
              <div className="history__main">
                <strong>{formatDateID(entry.date)}</strong>
                {entry.note ? <p>{entry.note}</p> : null}
                {entry.nextDueDate ? (
                  <p className="history__meta">
                    Berlaku sampai {formatDateID(entry.nextDueDate)}
                  </p>
                ) : null}
              </div>
              {entry.cost ? <span className="history__cost">{formatRupiah(entry.cost)}</span> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
