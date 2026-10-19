/** Thin wrapper over the Web Notifications API, with an audio chime and haptics. */

export type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export function notificationPermission(): PermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (notificationPermission() === 'unsupported') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return notificationPermission();
  }
}

/** Shows a system notification when allowed. Returns false so callers can fall back to an in-app banner. */
export function systemNotify(title: string, body: string, tag?: string): boolean {
  if (notificationPermission() !== 'granted') return false;
  try {
    const n = new Notification(title, { body, tag, icon: '/favicon.svg', silent: false });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

let ctx: AudioContext | null = null;

/** A soft two-note chime generated in-browser, so no audio assets are needed. */
export function chime(kind: 'soft' | 'alarm' = 'soft'): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new Ctor();
    const notes = kind === 'alarm' ? [880, 660, 880, 660] : [660, 990];
    notes.forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      const t = ctx!.currentTime + i * 0.22;
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.65);
    });
  } catch {
    // Audio can be blocked until the first user gesture; reminders still show visually.
  }
}

export function haptic(pattern: number | number[] = 12): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // unsupported
  }
}
