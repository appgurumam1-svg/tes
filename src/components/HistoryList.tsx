import { useState } from 'react';
import { formatDateID, formatRupiah } from '../lib/date';
import { scheduleApi } from '../lib/api';
import type { Schedule } from '../types';

interface HistoryListProps {
  schedule: Schedule;
  onDeleteAttachment?: (key: string) => void;
}

export function HistoryList({ schedule, onDeleteAttachment }: HistoryListProps) {
  const total = schedule.history.reduce((sum, entry) => sum + (entry.cost ?? 0), 0);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openAttachment(entryId: string, key: string) {
    setOpening(entryId);
    setError(null);
    try {
      const url = await scheduleApi.attachmentUrl(key);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Gagal membuka lampiran.');
    } finally {
      setOpening(null);
    }
  }

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
                {entry.attachment ? (
                  <div className="attachment">
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => openAttachment(entry.id, entry.attachment!.key)}
                      disabled={opening === entry.id}
                    >
                      📎 {opening === entry.id ? 'Membuka…' : entry.attachment.name}
                    </button>
                    {onDeleteAttachment ? (
                      <button
                        type="button"
                        className="link-btn link-btn--danger"
                        onClick={() => {
                          if (window.confirm('Hapus lampiran ini secara permanen?')) {
                            onDeleteAttachment(entry.attachment!.key);
                          }
                        }}
                      >
                        Hapus lampiran
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {entry.cost ? <span className="history__cost">{formatRupiah(entry.cost)}</span> : null}
            </li>
          ))}
        </ol>
      )}

      {error ? <p className="history__error">{error}</p> : null}
    </section>
  );
}
