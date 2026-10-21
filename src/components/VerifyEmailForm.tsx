import { useEffect, useRef, useState, type FormEvent } from 'react';
import { sendVerificationOtp, verifyEmailOtp } from '../lib/auth';

interface VerifyEmailFormProps {
  email: string;
  onVerified: () => void;
  onCancel: () => void;
}

export function VerifyEmailForm({ email, onVerified, onCancel }: VerifyEmailFormProps) {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const sentOnce = useRef(false);

  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    void sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function sendCode() {
    setError(null);
    setBusy(true);
    try {
      await sendVerificationOtp(email);
      setNotice(`Kode 6 digit dikirim ke ${email}. Cek inbox atau folder spam.`);
      setCooldown(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim kode.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('Kode OTP terdiri dari 6 angka.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyEmailOtp(email, otp.trim());
      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kode tidak valid.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <p className="confirm-text">
        Masukkan kode verifikasi yang dikirim ke <strong>{email}</strong>.
      </p>

      <div className="field">
        <label htmlFor="verify-otp">Kode OTP</label>
        <input
          id="verify-otp"
          className="input input--otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="6 digit"
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
          autoFocus
        />
      </div>

      {notice ? <p className="auth__notice">{notice}</p> : null}
      {error ? <p className="form__error">{error}</p> : null}

      <div className="form__actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={sendCode}
          disabled={busy || cooldown > 0}
        >
          {cooldown > 0 ? `Kirim ulang (${cooldown}s)` : 'Kirim ulang kode'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Nanti saja
        </button>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Memverifikasi…' : 'Verifikasi'}
        </button>
      </div>
    </form>
  );
}
