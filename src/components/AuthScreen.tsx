import { useState, type FormEvent } from 'react';
import {
  requestPasswordReset,
  resetPassword,
  signIn,
  signUp,
  type AuthUser,
} from '../lib/auth';
import { BellIcon } from './Icons';
import { PasswordInput } from './PasswordInput';

interface AuthScreenProps {
  onAuthenticated: (user: AuthUser) => void;
}

type Mode = 'signin' | 'signup' | 'forgot' | 'reset';

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
    setOtp('');
    setPassword('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim()) {
      setError('Email wajib diisi.');
      return;
    }
    if ((mode === 'signin' || mode === 'signup' || mode === 'reset') && !password) {
      setError('Password wajib diisi.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Nama wajib diisi saat mendaftar.');
      return;
    }
    if ((mode === 'signup' || mode === 'reset') && password.length < 8) {
      setError('Password minimal 8 karakter.');
      return;
    }
    if (mode === 'reset' && !/^\d{6}$/.test(otp.trim())) {
      setError('Kode OTP terdiri dari 6 angka.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        onAuthenticated(await signUp(email.trim(), password, name.trim()));
      } else if (mode === 'signin') {
        onAuthenticated(await signIn(email.trim(), password));
      } else if (mode === 'forgot') {
        await requestPasswordReset(email.trim());
        setMode('reset');
        setNotice(`Kode 6 digit dikirim ke ${email.trim()} (cek inbox/spam).`);
      } else {
        await resetPassword(email.trim(), otp.trim(), password);
        switchMode('signin');
        setNotice('Password berhasil diperbarui. Silakan masuk dengan password baru.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';
  const showTabs = mode === 'signin' || mode === 'signup';

  const title = isForgot
    ? 'Lupa password?'
    : isReset
      ? 'Atur password baru'
      : isSignup
        ? 'Buat akun baru'
        : 'Masuk ke akunmu';

  const subtitle = isForgot
    ? 'Masukkan email akunmu, kami kirim kode 6 digit untuk reset password.'
    : isReset
      ? 'Masukkan kode dari email dan password baru.'
      : 'Jadwalmu tersimpan di Neon Postgres dan bisa dibuka di perangkat mana pun.';

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

        <h1 className="auth__title">{title}</h1>
        <p className="auth__lead">{subtitle}</p>

        {showTabs ? (
          <div className="segmented auth__tabs" role="tablist" aria-label="Mode autentikasi">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              className={mode === 'signin' ? 'segmented__item is-active' : 'segmented__item'}
              onClick={() => switchMode('signin')}
            >
              Masuk
              <small>sudah punya akun</small>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={mode === 'signup' ? 'segmented__item is-active' : 'segmented__item'}
              onClick={() => switchMode('signup')}
            >
              Daftar
              <small>akun baru</small>
            </button>
          </div>
        ) : null}

        <form className="form" onSubmit={handleSubmit} noValidate>
          {isSignup ? (
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
              readOnly={isReset}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          {isReset ? (
            <div className="field">
              <label htmlFor="auth-otp">Kode OTP</label>
              <input
                id="auth-otp"
                className="input input--otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="6 digit"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
          ) : null}

          {isForgot ? null : (
            <div className="field">
              <label htmlFor="auth-password">{isReset ? 'Password baru' : 'Password'}</label>
              <PasswordInput
                id="auth-password"
                value={password}
                onChange={setPassword}
                autoComplete={isSignup || isReset ? 'new-password' : 'current-password'}
                placeholder="Minimal 8 karakter"
              />
            </div>
          )}

          {mode === 'signin' ? (
            <button
              type="button"
              className="link-btn auth__link"
              onClick={() => switchMode('forgot')}
            >
              Lupa password?
            </button>
          ) : null}

          {notice ? <p className="auth__notice">{notice}</p> : null}
          {error ? <p className="form__error">{error}</p> : null}

          <button type="submit" className="btn btn--primary auth__submit" disabled={busy}>
            {busy
              ? 'Memproses…'
              : isForgot
                ? 'Kirim kode'
                : isReset
                  ? 'Simpan password baru'
                  : isSignup
                    ? 'Daftar & masuk'
                    : 'Masuk'}
          </button>

          {!showTabs ? (
            <button
              type="button"
              className="link-btn auth__link auth__link--center"
              onClick={() => switchMode('signin')}
            >
              ← Kembali ke halaman masuk
            </button>
          ) : null}
        </form>

        <p className="auth__note">
          Autentikasi dikelola Neon Auth (Better Auth). Session disimpan sebagai cookie aman;
          datamu hanya bisa diakses akun ini.
        </p>
      </div>
    </div>
  );
}

