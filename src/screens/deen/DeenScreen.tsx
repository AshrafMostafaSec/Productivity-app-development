import { useState } from 'react';
import { motion } from 'motion/react';
import { Clock, Moon, Star } from 'lucide-react';
import type { AdhkarSessionId, PrayerId } from '../../types';
import { useStore } from '../../state/store';
import { adhkarProgress, lastDays } from '../../state/selectors';
import useNow from '../../lib/useNow';
import { PRAYER_NAMES, PRAYER_ORDER, SUNNAH_RAWATIB, currentPrayer, format12, hijriLabel } from '../../lib/time';
import { AFTER_PRAYER, EVENING, MORNING, SLEEP, SUNNAH_HABITS, TASBIH_PHRASES } from '../../data/adhkar';
import Screen, { CircleAction } from '../../ui/Screen';
import SubTabs from '../../ui/SubTabs';
import useSection from '../../ui/useSection';
import Group from '../../ui/Group';
import Row from '../../ui/Row';
import Check from '../../ui/Check';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import Stepper from '../../ui/Stepper';
import Toggle from '../../ui/Toggle';
import BarChart from '../../ui/BarChart';
import AnimatedNumber from '../../ui/AnimatedNumber';
import { ProgressBar, ProgressRing } from '../../ui/Progress';
import PrayerSheet from './PrayerSheet';
import AdhkarSheet from './AdhkarSheet';
import TasbihSheet from './TasbihSheet';
import PrayerTimesSheet from './PrayerTimesSheet';

const SECTIONS = ['salah', 'adhkar', 'quran', 'night'] as const;
type Section = (typeof SECTIONS)[number];
const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function DeenScreen() {
  const { state } = useStore();
  const now = useNow();
  const { section, direction, setSection } = useSection<Section>(SECTIONS);
  const [adhkarSession, setAdhkarSession] = useState<AdhkarSessionId | null>(null);
  const [timesOpen, setTimesOpen] = useState(false);
  const current = currentPrayer(state.prayerTimes, now);
  const pending = !!current && state.prayers[current].status === 'none';

  return (
    <Screen
      eyebrow={hijriLabel(now)}
      title="Deen"
      action={
        <CircleAction label="Edit prayer times" onClick={() => setTimesOpen(true)}>
          <Clock className="h-[18px] w-[18px]" strokeWidth={2.4} />
        </CircleAction>
      }
      tabs={
        <SubTabs
          value={section}
          onChange={setSection}
          options={[
            { value: 'salah', label: 'Salah', badge: pending },
            { value: 'adhkar', label: 'Adhkar' },
            { value: 'quran', label: 'Quran' },
            { value: 'night', label: 'Night' },
          ]}
        />
      }
      sectionKey={section}
      direction={direction}
    >
      {section === 'salah' && <SalahSection current={current} onAdhkar={setAdhkarSession} />}
      {section === 'adhkar' && <AdhkarSection current={current} onOpen={setAdhkarSession} />}
      {section === 'quran' && <QuranSection />}
      {section === 'night' && <NightSection onOpen={setAdhkarSession} />}

      <AdhkarSheet session={adhkarSession} onClose={() => setAdhkarSession(null)} />
      <PrayerTimesSheet open={timesOpen} onClose={() => setTimesOpen(false)} />
    </Screen>
  );
}

function SalahSection({ current, onAdhkar }: { current: PrayerId | null; onAdhkar: (s: AdhkarSessionId) => void }) {
  const { state, dispatch } = useStore();
  const [sheet, setSheet] = useState<PrayerId | null>(null);
  const week = lastDays(state, 7);
  const logged = PRAYER_ORDER.filter((p) => state.prayers[p].status !== 'none').length;
  const onTime = PRAYER_ORDER.filter((p) => state.prayers[p].status === 'on_time').length;

  return (
    <>
      <Card className="mb-7">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.02em] text-secondary">Today</p>
            <p className="text-[34px] font-bold leading-tight tracking-[-0.03em]">
              <AnimatedNumber value={logged} />
              <span className="text-[20px] text-secondary">/5</span>
            </p>
            <p className="text-[14px] text-secondary">{onTime} on time</p>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-semibold uppercase tracking-[0.02em] text-secondary">Streak</p>
            <p className="text-[34px] font-bold leading-tight tracking-[-0.03em] text-accent">
              <AnimatedNumber value={state.prayerStreak} />
            </p>
            <p className="text-[14px] text-secondary">full days</p>
          </div>
        </div>
        {/* Week grid: one column per day, one dot per prayer */}
        <div className="mt-4 flex justify-between border-t-[0.5px] border-separator pt-4">
          {week.map((d, i) => (
            <div key={d.dayKey} className="flex flex-col items-center gap-1.5">
              {Array.from({ length: 5 }, (_, k) => (
                <motion.span
                  key={k}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.03 + k * 0.02 }}
                  className={`h-2.5 w-2.5 rounded-full ${k < d.prayers ? (k < d.onTime ? 'bg-accent' : 'bg-accent/45') : 'bg-fill-strong'}`}
                />
              ))}
              <span className={`mt-1 text-[11px] font-medium ${i === week.length - 1 ? 'text-accent' : 'text-secondary'}`}>
                {WEEKDAY[new Date(d.dayKey + 'T12:00').getDay()]}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Group header="Prayers" footer="Tap the circle to log on time. Tap the row for late, sunnah, and after-prayer adhkar.">
        {PRAYER_ORDER.map((p) => {
          const day = state.prayers[p];
          const isNow = p === current && day.status === 'none';
          return (
            <Row
              key={p}
              leading={
                <Check
                  checked={day.status !== 'none'}
                  label={`Log ${PRAYER_NAMES[p].en}`}
                  onChange={() => dispatch({ type: 'prayer/log', id: p, status: day.status === 'none' ? 'on_time' : 'none' })}
                />
              }
              title={
                <span className="flex items-baseline gap-2">
                  {PRAYER_NAMES[p].en}
                  <span className="font-arabic text-[17px] text-secondary">{PRAYER_NAMES[p].ar}</span>
                </span>
              }
              subtitle={`${format12(state.prayerTimes[p])} · ${day.sunnah ? 'Sunnah ✓' : SUNNAH_RAWATIB[p]}`}
              trailing={
                isNow ? (
                  <motion.span animate={{ opacity: [1, 0.55, 1] }} transition={{ duration: 1.8, repeat: Infinity }} className="rounded-full bg-accent px-2 py-0.5 text-[12px] font-semibold text-white">
                    Now
                  </motion.span>
                ) : day.status !== 'none' ? (
                  <span className="text-[15px] text-secondary">{day.status === 'late' ? 'Late' : 'On time'}</span>
                ) : null
              }
              onClick={() => setSheet(p)}
              chevron
            />
          );
        })}
      </Group>

      <PrayerSheet
        prayer={sheet}
        onClose={() => setSheet(null)}
        onOpenAdhkar={(p) => {
          setSheet(null);
          onAdhkar(`after:${p}`);
        }}
      />
    </>
  );
}

function AdhkarSection({ current, onOpen }: { current: PrayerId | null; onOpen: (s: AdhkarSessionId) => void }) {
  const { state, dispatch } = useStore();
  const [tasbihOpen, setTasbihOpen] = useState(false);
  const after: AdhkarSessionId = `after:${current ?? 'isha'}`;
  const phrase = TASBIH_PHRASES.find((p) => p.id === state.tasbih.phraseId) ?? TASBIH_PHRASES[0];
  const weekday = new Date().getDay();

  const cards: { id: AdhkarSessionId; title: string; ar: string; sub: string }[] = [
    { id: 'morning', title: 'Morning', ar: MORNING.arabicTitle, sub: MORNING.subtitle },
    { id: 'evening', title: 'Evening', ar: EVENING.arabicTitle, sub: EVENING.subtitle },
    { id: after, title: `After ${PRAYER_NAMES[current ?? 'isha'].en}`, ar: AFTER_PRAYER.arabicTitle, sub: AFTER_PRAYER.subtitle },
    { id: 'sleep', title: 'Sleep', ar: SLEEP.arabicTitle, sub: SLEEP.subtitle },
  ];

  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-3">
        {cards.map((c, i) => {
          const prog = adhkarProgress(state, c.id);
          return (
            <motion.button
              key={c.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onOpen(c.id)}
              className={`relative flex flex-col items-start overflow-hidden rounded-[18px] p-3.5 text-left ${prog.complete ? 'bg-accent text-white' : 'bg-card'}`}
            >
              <div className="flex w-full items-start justify-between">
                <ProgressRing value={prog.done / prog.total} size={34} stroke={4} color={prog.complete ? '#fff' : undefined} track={prog.complete ? 'rgba(255,255,255,0.3)' : undefined} />
                <span className={`tabular text-[13px] font-semibold ${prog.complete ? 'text-white/80' : 'text-secondary'}`}>
                  {prog.complete ? 'Done' : `${prog.done}/${prog.total}`}
                </span>
              </div>
              <p className={`mt-3 font-arabic text-[19px] leading-tight ${prog.complete ? '' : 'text-secondary'}`}>{c.ar}</p>
              <p className="text-[17px] font-semibold">{c.title}</p>
              <p className={`text-[12px] ${prog.complete ? 'text-white/75' : 'text-secondary'}`}>{c.sub}</p>
            </motion.button>
          );
        })}
      </div>

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => setTasbihOpen(true)}
        className="mb-7 flex w-full items-center gap-4 rounded-[18px] bg-card p-4 text-left"
      >
        <ProgressRing value={(state.tasbih.count % state.tasbih.target) / state.tasbih.target} size={52} stroke={5}>
          <span className="tabular text-[14px] font-semibold">{state.tasbih.count % state.tasbih.target}</span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold">Tasbih</p>
          <p className="text-[13px] text-secondary">
            {phrase.title} · {state.tasbih.totalToday} today
          </p>
        </div>
        <p dir="rtl" className="font-arabic text-[20px] text-secondary">
          {phrase.arabic}
        </p>
      </motion.button>

      <Group header="Sunnah habits">
        {SUNNAH_HABITS.filter((h) => !h.days || h.days.includes(weekday)).map((h) => (
          <Row
            key={h.id}
            leading={<Check checked={!!state.habits[h.id]} label={h.title} onChange={() => dispatch({ type: 'habit/toggle', id: h.id, title: h.title })} />}
            title={h.title}
            subtitle={h.detail}
            muted={!!state.habits[h.id]}
          />
        ))}
      </Group>

      <TasbihSheet open={tasbihOpen} onClose={() => setTasbihOpen(false)} />
    </>
  );
}

function QuranSection() {
  const { state, dispatch } = useStore();
  const { quran } = state;
  const week = lastDays(state, 7);
  const juz = Math.min(30, Math.floor(quran.position / 20.13) + 1);

  return (
    <>
      <Card className="mb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.02em] text-secondary">Today’s wird</p>
            <p className="text-[40px] font-bold leading-tight tracking-[-0.03em]">
              <AnimatedNumber value={quran.pagesToday} />
              <span className="text-[20px] font-semibold text-secondary"> / {quran.goalPages} pages</span>
            </p>
          </div>
          <div className="text-right">
            <p className="font-arabic text-[22px] leading-tight">جزء {juz}</p>
            <p className="text-[13px] text-secondary">Page {quran.position} / 604</p>
          </div>
        </div>
        <div className="mt-3">
          <ProgressBar value={quran.pagesToday / quran.goalPages} />
        </div>
        <div className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2">
          <Button onClick={() => dispatch({ type: 'quran/addPages', pages: 1 })}>+1 page</Button>
          <Button variant="tinted" onClick={() => dispatch({ type: 'quran/addPages', pages: 5 })}>
            +5
          </Button>
          <Button variant="gray" onClick={() => dispatch({ type: 'quran/addPages', pages: -1 })} disabled={quran.pagesToday === 0}>
            Undo
          </Button>
        </div>
      </Card>

      <Card className="mb-4">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-[15px] font-semibold">This week</p>
          <p className="text-[13px] text-secondary">{quran.streak > 0 ? `${quran.streak}-day streak` : 'Start a streak today'}</p>
        </div>
        <BarChart
          data={week.map((d, i) => ({ label: WEEKDAY[new Date(d.dayKey + 'T12:00').getDay()], value: d.quranPages, highlight: i === week.length - 1 }))}
          goal={quran.goalPages}
          height={90}
        />
      </Card>

      <Group footer={`At ${quran.goalPages} ${quran.goalPages === 1 ? 'page' : 'pages'} a day you finish a khatma in about ${Math.ceil(604 / quran.goalPages)} days.`}>
        <Row
          title="Daily goal"
          trailing={
            <>
              <span className="tabular w-16 text-right text-[17px] text-secondary">{quran.goalPages} pg</span>
              <Stepper
                label="daily goal"
                canDecrement={quran.goalPages > 1}
                onDecrement={() => dispatch({ type: 'quran/setGoal', pages: quran.goalPages - 1 })}
                onIncrement={() => dispatch({ type: 'quran/setGoal', pages: Math.min(40, quran.goalPages + 1) })}
              />
            </>
          }
        />
      </Group>
    </>
  );
}

function NightSection({ onOpen }: { onOpen: (s: AdhkarSessionId) => void }) {
  const { state, dispatch } = useStore();
  const { qiyam } = state;
  const sleep = adhkarProgress(state, 'sleep');
  const isha = state.prayerTimes.isha;

  return (
    <>
      <div className="relative mb-7 overflow-hidden rounded-[22px] p-5 text-white" style={{ background: 'linear-gradient(160deg,#0f1b3d,#2b3f78)' }}>
        {[20, 70, 140, 220, 280].map((x, i) => (
          <motion.span key={i} className="absolute h-[2px] w-[2px] rounded-full bg-white" style={{ left: x, top: 14 + ((i * 31) % 60) }} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 2 + i * 0.5, repeat: Infinity }} />
        ))}
        <Moon className="relative h-7 w-7 text-[#f5f1d6]" fill="currentColor" />
        <p className="relative mt-3 font-arabic text-[26px] leading-tight">قيام الليل</p>
        <p className="relative text-[15px] text-white/70">The last third of the night is the best time. Two rak‘ahs are enough to begin.</p>
        <div className="relative mt-5 flex items-center justify-between">
          <div>
            <p className="tabular text-[44px] font-bold leading-none">
              <AnimatedNumber value={qiyam.rakaat} />
            </p>
            <p className="text-[13px] text-white/60">rak‘ahs tonight</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => dispatch({ type: 'qiyam/set', rakaat: qiyam.rakaat - 2 })} disabled={qiyam.rakaat === 0} className="h-11 w-11 rounded-full bg-white/12 text-[22px] disabled:opacity-30" aria-label="Remove 2 rak‘ahs">
              −
            </button>
            <button onClick={() => dispatch({ type: 'qiyam/set', rakaat: qiyam.rakaat + 2 })} className="h-11 rounded-full bg-white px-5 text-[16px] font-semibold text-[#0f1b3d]" aria-label="Add 2 rak‘ahs">
              +2
            </button>
          </div>
        </div>
      </div>

      <Group>
        <Row leading={<Star className="h-5 w-5 text-accent" />} title="Witr prayed" trailing={<Toggle label="Witr prayed" checked={qiyam.witr} onChange={() => dispatch({ type: 'qiyam/set', witr: !qiyam.witr })} />} />
        <Row
          leading={<ProgressRing value={sleep.done / sleep.total} />}
          title="Adhkar before sleep"
          subtitle={`${SLEEP.arabicTitle} · ${sleep.done}/${sleep.total}`}
          onClick={() => onOpen('sleep')}
          chevron
        />
      </Group>
      <p className="px-4 text-[13px] leading-snug text-secondary">Tip: set a Fajr alarm with a wake-up mission in Settings so you actually get up. Isha today is at {format12(isha)}.</p>
    </>
  );
}
