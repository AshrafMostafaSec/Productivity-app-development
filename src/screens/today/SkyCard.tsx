import { motion } from 'motion/react';
import type { PrayerId } from '../../types';
import { useStore } from '../../state/store';
import { prayerLockReason } from '../../state/reducer';
import { PRAYER_NAMES, PRAYER_ORDER, durationLabel, format12, minutesOf, nextPrayer } from '../../lib/time';
import { softSpring } from '../../ui/motion';

type Sky = 'night' | 'dawn' | 'day' | 'afternoon' | 'sunset';

const SKIES: Record<Sky, { bg: string; dark: boolean; sun: string }> = {
  night: { bg: 'linear-gradient(160deg,#0f1b3d 0%,#25386b 60%,#3d4f86 100%)', dark: true, sun: '#f5f1d6' },
  dawn: { bg: 'linear-gradient(160deg,#ffd9b8 0%,#f7c6c7 40%,#a9c8f2 100%)', dark: false, sun: '#fff4d6' },
  day: { bg: 'linear-gradient(160deg,#8cc4ff 0%,#bfdcff 55%,#eaf4ff 100%)', dark: false, sun: '#fff7cf' },
  afternoon: { bg: 'linear-gradient(160deg,#ffcf8f 0%,#ffd9b0 40%,#b6d4ff 100%)', dark: false, sun: '#fff1c4' },
  sunset: { bg: 'linear-gradient(160deg,#ff9e7a 0%,#c77dab 50%,#5d5fb0 100%)', dark: true, sun: '#ffe1b8' },
};

function skyFor(mins: number, t: Record<PrayerId, string>): Sky {
  const fajr = minutesOf(t.fajr);
  if (mins < fajr) return 'night';
  if (mins < fajr + 90) return 'dawn';
  if (mins < minutesOf(t.asr)) return 'day';
  if (mins < minutesOf(t.maghrib) - 20) return 'afternoon';
  if (mins < minutesOf(t.isha)) return 'sunset';
  return 'night';
}

const W = 320;
const H = 92;

/** The day as a sky: the sun travels an arc across the five prayer times. */
export default function SkyCard({ now, current }: { now: Date; current: PrayerId | null }) {
  const { state, dispatch } = useStore();
  const t = state.prayerTimes;
  const mins = now.getHours() * 60 + now.getMinutes();
  const sky = SKIES[skyFor(mins, t)];
  const next = nextPrayer(t, now);
  const pending = current && state.prayers[current].status === 'none' ? current : null;
  const lock = prayerLockReason(state, current);

  const start = minutesOf(t.fajr) - 45;
  const end = minutesOf(t.isha) + 45;
  const frac = (m: number) => Math.max(0, Math.min(1, (m - start) / (end - start)));
  const pt = (f: number) => ({ x: 14 + f * (W - 28), y: H - 8 - Math.sin(Math.PI * f) * (H - 26) });
  const sun = pt(frac(mins));
  const isNight = mins < start || mins > end;

  const text = sky.dark ? 'text-white' : 'text-[#0b1a33]';
  const sub = sky.dark ? 'text-white/70' : 'text-[#0b1a33]/60';

  return (
    <motion.div layout className="relative overflow-hidden rounded-[22px] p-4 shadow-[0_10px_30px_rgba(40,70,140,0.18)]" style={{ background: sky.bg }}>
      {sky.dark &&
        [12, 48, 80, 130, 210, 260, 290].map((x, i) => (
          <motion.span
            key={i}
            className="absolute h-[2px] w-[2px] rounded-full bg-white"
            style={{ left: x, top: 10 + ((i * 23) % 50) }}
            animate={{ opacity: [0.2, 0.9, 0.2] }}
            transition={{ duration: 2.5 + i * 0.4, repeat: Infinity }}
          />
        ))}

      <div className="relative">
        <p className={`text-[13px] font-semibold uppercase tracking-[0.04em] ${sub}`}>{pending ? 'Prayer time' : 'Next prayer'}</p>
        <div className="mt-0.5 flex items-baseline justify-between gap-2">
          <p className={`text-[30px] font-bold leading-tight tracking-[-0.025em] ${text}`}>
            {pending ? `${PRAYER_NAMES[pending].en} is in` : PRAYER_NAMES[next.id].en}
          </p>
          <p className={`font-arabic text-[26px] leading-none ${text}`}>{PRAYER_NAMES[pending ?? next.id].ar}</p>
        </div>
        <p className={`mt-0.5 text-[15px] ${sub}`}>
          {pending
            ? `Until ${format12(t[next.id])}${lock ? ' · apps locked until you pray' : ''}`
            : `${format12(t[next.id])} · in ${durationLabel(next.inMinutes)}`}
        </p>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="relative mt-2 w-full" aria-hidden>
        <path
          d={`M ${pt(0).x} ${pt(0).y} ${Array.from({ length: 40 }, (_, i) => {
            const p = pt((i + 1) / 40);
            return `L ${p.x} ${p.y}`;
          }).join(' ')}`}
          fill="none"
          stroke={sky.dark ? 'rgba(255,255,255,0.35)' : 'rgba(11,26,51,0.25)'}
          strokeWidth={1.5}
          strokeDasharray="3 5"
        />
        {PRAYER_ORDER.map((id) => {
          const p = pt(frac(minutesOf(t[id])));
          const logged = state.prayers[id].status !== 'none';
          return (
            <g key={id}>
              <circle cx={p.x} cy={p.y} r={logged ? 5 : 4} fill={logged ? (sky.dark ? '#fff' : '#0b1a33') : 'transparent'} stroke={sky.dark ? '#fff' : '#0b1a33'} strokeOpacity={0.7} strokeWidth={1.5} />
              <text x={p.x} y={Math.min(H - 1, p.y + 16)} textAnchor="middle" fontSize="9" fontWeight={600} fill={sky.dark ? 'rgba(255,255,255,0.75)' : 'rgba(11,26,51,0.6)'}>
                {PRAYER_NAMES[id].en}
              </text>
            </g>
          );
        })}
        {!isNight && (
          <motion.g initial={false} animate={{ x: sun.x, y: sun.y }} transition={softSpring}>
            <motion.circle r={16} fill={sky.sun} opacity={0.35} animate={{ r: [14, 19, 14] }} transition={{ duration: 4, repeat: Infinity }} />
            <circle r={8} fill={sky.sun} stroke="rgba(255,255,255,0.9)" strokeWidth={2} />
          </motion.g>
        )}
      </svg>

      {pending && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => dispatch({ type: 'prayer/log', id: pending, status: 'on_time' })}
          className="relative mt-2 h-12 w-full rounded-[14px] bg-white/95 text-[17px] font-semibold text-accent shadow-[0_4px_14px_rgba(0,0,0,0.08)]"
        >
          I prayed {PRAYER_NAMES[pending].en}
        </motion.button>
      )}
    </motion.div>
  );
}
