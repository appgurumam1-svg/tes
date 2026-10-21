import { useState, type FormEvent } from 'react';
import type { CategoryItem } from '../types';
import { PencilIcon, PlusIcon, TrashIcon } from './Icons';

interface CategoryManagerProps {
  categories: CategoryItem[];
  counts: Map<string, number>;
  onAdd: (name: string, emoji: string) => Promise<void>;
  onUpdate: (id: string, name: string, emoji: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const EMOJI_SUGGESTIONS = ['🛵', '🪪', '🩺', '📱', '🏠', '📌', '🧾', '🧰', '🎓', '💳', '🐾', '🌱'];

export function CategoryManager({
  categories,
  counts,
  onAdd,
  onUpdate,
  onDelete,
}: CategoryManagerProps) {
  const [emoji, setEmoji] = useState('📌');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError('Nama kategori wajib diisi.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onAdd(clean, emoji.trim() || '📌');
      setName('');
      setEmoji('📌');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menambah kategori.');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(category: CategoryItem) {
    setEditingId(category.id);
    setEditName(category.name);
    setEditEmoji(category.emoji);
    setError(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    const clean = editName.trim();
    if (!clean) {
      setError('Nama kategori wajib diisi.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onUpdate(editingId, clean, editEmoji.trim() || '📌');
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan kategori.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(category: CategoryItem) {
    const used = counts.get(category.id) ?? 0;
    const message =
      used > 0
        ? `${used} jadwal memakai kategori "${category.name}" dan akan dipindah ke "Lainnya". Hapus kategori ini?`
        : `Hapus kategori "${category.name}"?`;
    if (!window.confirm(message)) return;

    setBusy(true);
    setError(null);
    try {
      await onDelete(category.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus kategori.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="category-manager">
      <form className="category-add" onSubmit={handleAdd}>
        <input
          className="input input--emoji"
          value={emoji}
          onChange={(event) => setEmoji(event.target.value.slice(0, 4))}
          aria-label="Emoji kategori"
          placeholder="📌"
        />
        <input
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="Nama kategori baru"
          placeholder="Nama kategori (mis. Elektronik)"
          maxLength={40}
        />
        <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>
          <PlusIcon size={15} />
          Tambah
        </button>
      </form>

      <div className="emoji-suggestions" aria-label="Pilihan emoji">
        {EMOJI_SUGGESTIONS.map((item) => (
          <button
            key={item}
            type="button"
            className={`emoji-chip${emoji === item ? ' is-active' : ''}`}
            onClick={() => setEmoji(item)}
            aria-label={`Pilih emoji ${item}`}
          >
            {item}
          </button>
        ))}
      </div>

      {error ? <p className="form__error">{error}</p> : null}

      <ul className="category-list">
        {categories.map((category) => {
          const used = counts.get(category.id) ?? 0;
          const isEditing = editingId === category.id;

          return (
            <li key={category.id} className="category-row">
              {isEditing ? (
                <>
                  <input
                    className="input input--emoji"
                    value={editEmoji}
                    onChange={(event) => setEditEmoji(event.target.value.slice(0, 4))}
                    aria-label="Emoji kategori"
                  />
                  <input
                    className="input"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    aria-label="Nama kategori"
                    maxLength={40}
                  />
                  <div className="category-row__actions">
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => void saveEdit()}
                      disabled={busy}
                    >
                      Simpan
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setEditingId(null)}
                      disabled={busy}
                    >
                      Batal
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="category-row__emoji" aria-hidden="true">
                    {category.emoji}
                  </span>
                  <div className="category-row__main">
                    <strong>{category.name}</strong>
                    <span className="category-row__count">
                      {used} jadwal · id: {category.id}
                    </span>
                  </div>
                  <div className="category-row__actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => startEdit(category)}
                      title="Edit kategori"
                    >
                      <PencilIcon size={15} />
                      <span className="sr-only">Edit {category.name}</span>
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      onClick={() => void handleDelete(category)}
                      disabled={category.id === 'lainnya' || busy}
                      title={
                        category.id === 'lainnya'
                          ? 'Kategori "Lainnya" tidak bisa dihapus'
                          : 'Hapus kategori'
                      }
                    >
                      <TrashIcon size={15} />
                      <span className="sr-only">Hapus {category.name}</span>
                    </button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

