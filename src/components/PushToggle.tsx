import { useEffect, useState } from 'react';
import { currentPushSubscription, disablePush, enablePush, pushSupported } from '../lib/push';
import { BellIcon } from './Icons';

type PushState = 'loading' | 'off' | 'on' | 'denied' | 'busy' | 'unsupported';

export function PushToggle() {
  const [state, setState] = useState<PushState>(pushSupported ? 'loading' : 'unsupported');

  useEffect(() => {
    if (!pushSupported) return;
    let cancelled = false;
    void (async () => {
      const subscription = await currentPushSubscription();
      if (cancelled) return;
      setState(subscription ? 'on' : Notification.permission === 'denied' ? 'denied' : 'off');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!pushSupported || state === 'loading') return null;

  const label =
    state === 'on'
      ? 'Matikan notifikasi'
      : state === 'denied'
        ? 'Notifikasi diblokir browser'
        : 'Aktifkan notifikasi';

  async function toggle() {
    setState('busy');
    try {
      if (state === 'on') {
        await disablePush();
        setState('off');
      } else {
        await enablePush();
        setState('on');
      }
    } catch (error) {
      setState(Notification.permission === 'denied' ? 'denied' : 'off');
      window.alert(error instanceof Error ? error.message : 'Gagal mengubah notifikasi.');
    }
  }

  return (
    <button
      type="button"
      className={`icon-btn${state === 'on' ? ' icon-btn--on' : ''}`}
      onClick={toggle}
      disabled={state === 'denied' || state === 'busy'}
      title={label}
      aria-label={label}
      aria-pressed={state === 'on'}
    >
      <BellIcon size={17} />
    </button>
  );
}
