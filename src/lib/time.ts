import type { PrayerId } from '../types';

export const PRAYER_ORDER: PrayerId[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export const PRAYER_NAMES: Record<PrayerId, { en: string; ar: string }> = {
  fajr: { en: 'Fajr', ar: 'الفجر' },
  dhuhr: { en: 'Dhuhr', ar: 'الظهر' },
  asr: { en: 'Asr', ar: 'العصر' },
  maghrib: { en: 'Maghrib', ar: 'المغرب' },
  isha: { en: 'Isha', ar: 'العشاء' },
};

export const SUNNAH_RAWATIB: Record<PrayerId, string> = {
  fajr: '2 before',
  dhuhr: '4 before · 2 after',
  asr: 'No rawatib',
  maghrib: '2 after',
  isha: '2 after · Witr',
};

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKeyOf(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function format12(hhmm: string): string {
  const total = minutesOf(hhmm);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${suffix}`;
}

export function clockTime(date: Date): string {
  return `${date.getHours() % 12 === 0 ? 12 : date.getHours() % 12}:${pad(date.getMinutes())}`;
}

export function timeLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** The prayer whose window is currently open. Null before Fajr (night after rollover). */
export function currentPrayer(times: Record<PrayerId, string>, now: Date): PrayerId | null {
  const mins = now.getHours() * 60 + now.getMinutes();
  let current: PrayerId | null = null;
  for (const id of PRAYER_ORDER) {
    if (minutesOf(times[id]) <= mins) current = id;
  }
  return current;
}

export function nextPrayer(
  times: Record<PrayerId, string>,
  now: Date,
): { id: PrayerId; inMinutes: number; tomorrow: boolean } {
  const mins = now.getHours() * 60 + now.getMinutes();
  for (const id of PRAYER_ORDER) {
    const t = minutesOf(times[id]);
    if (t > mins) return { id, inMinutes: t - mins, tomorrow: false };
  }
  return { id: 'fajr', inMinutes: 24 * 60 - mins + minutesOf(times.fajr), tomorrow: true };
}

export function durationLabel(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

export function daysUntil(dateKey: string, now: Date = new Date()): number {
  const [y, mo, d] = dateKey.split('-').map(Number);
  const due = new Date(y, mo - 1, d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((due - today) / 86_400_000);
}

export function dueLabel(dateKey: string, now: Date = new Date()): string {
  const days = daysUntil(dateKey, now);
  if (days < 0) return `${-days}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days < 7) {
    const [y, mo, d] = dateKey.split('-').map(Number);
    return `Due ${new Date(y, mo - 1, d).toLocaleDateString([], { weekday: 'long' })}`;
  }
  return `Due in ${days} days`;
}

export function addDays(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return dayKeyOf(d);
}

export function gregorianLabel(now: Date): string {
  return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function hijriLabel(now: Date): string {
  try {
    return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);
  } catch {
    return '';
  }
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
