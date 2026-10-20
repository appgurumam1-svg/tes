import { useState, type FormEvent } from 'react';
import { signIn, signUp, type AuthUser } from '../lib/auth';
import { BellIcon } from './Icons';

interface AuthScreenProps {
  onAuthenticated: (user: AuthUser) => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Email dan password wajib diisi.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Nama wajib diisi saat mendaftar.');
      return;
    }
    if (password.length < 8) {
      setError('Password minimal 8 karakter.');
      return;
    }

    setBusy(true);
    try {
      const user =
        mode === 'signup'
          ? await signUp(email.trim(), password, name.trim())
          : await signIn(email.trim(), password);
      onAuthenticated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <div className="brand auth__brand">
          <span className="brand__mark" aria-hidden="true">
            <BellIcon size={19} />
          </span>
          <div className="brand__text">
            <strong>Tenggat</strong>
            <span>Pengingat servis &amp; masa berlaku</span>
          </div>
        </div>

        <h1 className="auth__title">
          {mode === 'signin' ? 'Masuk ke akunmu' : 'Buat akun baru'}
        </h1>
        <p className="auth__lead">
          Jadwalmu tersimpan di Neon Postgres dan bisa dibuka dari perangkat mana pun.
        </p>

        <div className="segmented auth__tabs" role="tablist" aria-label="Mode autentikasi">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={mode === 'signin' ? 'segmented__item is-active' : 'segmented__item'}
            onClick={() => {
              setMode('signin');
              setError(null);
            }}
          >
            Masuk
            <small>sudah punya akun</small>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={mode === 'signup' ? 'segmented__item is-active' : 'segmented__item'}
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
          >
            Daftar
            <small>akun baru</small>
          </button>
        </div>

        <form className="form" onSubmit={handleSubmit} noValidate>
          {mode === 'signup' ? (
            <div className="field">
              <label htmlFor="auth-name">Nama</label>
              <input
                id="auth-name"
                className="input"
                value={name}
                autoComplete="name"
                placeholder="Nama kamu"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              className="input"
              type="email"
              value={email}
              autoComplete="email"
              placeholder="nama@email.com"
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              className="input"
              type="password"
              value={password}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder="Minimal 8 karakter"
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error ? <p className="form__error">{error}</p> : null}

          <button type="submit" className="btn btn--primary auth__submit" disabled={busy}>
            {busy ? 'Memproses…' : mode === 'signin' ? 'Masuk' : 'Daftar & masuk'}
          </button>
        </form>

        <p className="auth__note">
          Autentikasi dikelola Neon Auth (Better Auth). Session disimpan sebagai cookie aman;
          datamu hanya bisa diakses akun ini.
        </p>
      </div>
    </div>
  );
}
