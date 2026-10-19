import { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, X } from 'lucide-react';
import type { ExpenseCategory } from '../../types';
import { useStore } from '../../state/store';
import { impulseRemainingHours, lastDays, money, safeToSpend, spentToday } from '../../state/selectors';
import useNow from '../../lib/useNow';
import { timeLabel } from '../../lib/time';
import Screen, { CircleAction } from '../../ui/Screen';
import SubTabs from '../../ui/SubTabs';
import useSection from '../../ui/useSection';
import Group from '../../ui/Group';
import Row from '../../ui/Row';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import IconButton from '../../ui/IconButton';
import EmptyState from '../../ui/EmptyState';
import BarChart from '../../ui/BarChart';
import AnimatedNumber from '../../ui/AnimatedNumber';
import { ProgressRing } from '../../ui/Progress';
import { softSpring } from '../../ui/motion';
import AddExpenseSheet from './AddExpenseSheet';
import AddImpulseSheet from './AddImpulseSheet';
import BudgetSheet from './BudgetSheet';

const SECTIONS = ['today', 'pause', 'trends'] as const;
type Section = (typeof SECTIONS)[number];
const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CATEGORIES: ExpenseCategory[] = ['Food', 'Study', 'Transport', 'Personal'];

export default function WalletScreen() {
  const { state } = useStore();
  const now = useNow(60_000);
  const { section, direction, setSection } = useSection<Section>(SECTIONS);
  const [addingExpense, setAddingExpense] = useState(false);
  const [impulseDraft, setImpulseDraft] = useState<{ title: string; price: string } | null>(null);
  const ready = state.impulses.some((i) => i.status === 'cooling' && impulseRemainingHours(i, now.getTime()) <= 0);

  return (
    <Screen
      eyebrow="Spend on purpose"
      title="Wallet"
      action={
        <CircleAction
          label={section === 'pause' ? 'Pause a purchase' : 'Log expense'}
          onClick={() => (section === 'pause' ? setImpulseDraft({ title: '', price: '' }) : setAddingExpense(true))}
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} />
        </CircleAction>
      }
      tabs={
        <SubTabs
          value={section}
          onChange={setSection}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'pause', label: 'Pause', badge: ready },
            { value: 'trends', label: 'Trends' },
          ]}
        />
      }
      sectionKey={section}
      direction={direction}
    >
      {section === 'today' && <TodaySection onAdd={() => setAddingExpense(true)} />}
      {section === 'pause' && <PauseSection now={now} onAdd={() => setImpulseDraft({ title: '', price: '' })} />}
      {section === 'trends' && <TrendsSection />}

      <AddExpenseSheet
        open={addingExpense}
        onClose={() => setAddingExpense(false)}
        onPauseInstead={(title, price) => {
          setAddingExpense(false);
          setSection('pause');
          setImpulseDraft({ title, price });
        }}
      />
      <AddImpulseSheet draft={impulseDraft} onClose={() => setImpulseDraft(null)} />
    </Screen>
  );
}

function TodaySection({ onAdd }: { onAdd: () => void }) {
  const { state, dispatch } = useStore();
  const [editingBudget, setEditingBudget] = useState(false);
  const spent = spentToday(state);
  const safe = safeToSpend(state);
  const today = state.expenses.filter((e) => e.dayKey === state.dayKey);
  const fmt = (v: number) => money(state, v);

  return (
    <>
      <Card className="mb-7">
        <div className="flex items-start justify-between">
          <p className="text-[13px] font-semibold uppercase tracking-[0.02em] text-secondary">{safe >= 0 ? 'Safe to spend today' : 'Over today’s budget by'}</p>
          <button onClick={() => setEditingBudget(true)} className="text-[15px] text-accent">
            Edit
          </button>
        </div>
        <div className="mt-2 flex items-center gap-4">
          <ProgressRing value={spent / Math.max(1, state.budget.daily)} size={72} stroke={9} color={safe < 0 ? 'var(--color-danger)' : undefined}>
            <span className="text-[12px] font-semibold text-secondary">{Math.min(999, Math.round((spent / Math.max(1, state.budget.daily)) * 100))}%</span>
          </ProgressRing>
          <div>
            <p className={`text-[44px] font-bold leading-none tracking-[-0.03em] ${safe < 0 ? 'text-danger' : ''}`}>
              <AnimatedNumber value={Math.abs(safe)} format={fmt} />
            </p>
            <p className="mt-1.5 text-[14px] text-secondary">
              Spent {fmt(spent)} of {fmt(state.budget.daily)}
            </p>
          </div>
        </div>
      </Card>

      <Group header={`Today · ${today.length}`}>
        {today.length === 0 && (
          <div className="ios-row p-6 text-center">
            <p className="text-[15px] font-semibold">Nothing logged yet</p>
            <p className="mt-1 text-[13px] text-secondary">Logging takes five seconds, and it’s how the budget stays honest.</p>
            <Button size="sm" variant="tinted" className="mt-3" onClick={onAdd}>
              Log expense
            </Button>
          </div>
        )}
        {today.map((e) => (
          <Row
            key={e.id}
            title={e.title}
            subtitle={`${e.category} · ${timeLabel(e.at)}`}
            trailing={
              <>
                <span className="tabular text-[17px] font-medium">{money(state, e.amount)}</span>
                <IconButton label={`Delete ${e.title}`} onClick={() => dispatch({ type: 'wallet/deleteExpense', id: e.id })}>
                  <X className="h-4 w-4" />
                </IconButton>
              </>
            }
          />
        ))}
      </Group>
      <BudgetSheet open={editingBudget} onClose={() => setEditingBudget(false)} />
    </>
  );
}

function PauseSection({ now, onAdd }: { now: Date; onAdd: () => void }) {
  const { state, dispatch } = useStore();
  const cooling = state.impulses.filter((i) => i.status === 'cooling');
  const decided = state.impulses.filter((i) => i.status !== 'cooling').slice(0, 8);
  const skipped = state.impulses.filter((i) => i.status === 'skipped').length;
  const fmt = (v: number) => money(state, v);

  return (
    <>
      <Card className="mb-7">
        <p className="text-[13px] font-semibold uppercase tracking-[0.02em] text-secondary">Saved by waiting</p>
        <p className="text-[44px] font-bold leading-tight tracking-[-0.03em] text-accent">
          <AnimatedNumber value={state.savedTotal} format={fmt} />
        </p>
        <p className="text-[14px] text-secondary">
          {skipped} {skipped === 1 ? 'urge' : 'urges'} skipped. Wanting something isn’t the same as needing it.
        </p>
        <Button block className="mt-4" variant="tinted" onClick={onAdd}>
          I want to buy something
        </Button>
      </Card>

      <Group header="Cooling off" footer="When the timer ends you decide with a calm head. Most urges are gone by then.">
        {cooling.length === 0 && <EmptyState title="Nothing waiting" detail="Park the next thing you feel the urge to buy." />}
        {cooling.map((item) => {
          const left = impulseRemainingHours(item, now.getTime());
          const ready = left <= 0;
          return (
            <Row
              key={item.id}
              leading={<ProgressRing value={1 - left / item.waitHours} size={32} stroke={4} />}
              title={`${item.title} · ${money(state, item.price)}`}
              subtitle={ready ? 'Cooled off. Still want it?' : `${Math.ceil(left)} hr left${item.trigger ? ` · ${item.trigger}` : ''}`}
              trailing={
                <>
                  {ready && (
                    <Button size="sm" variant="gray" onClick={() => dispatch({ type: 'wallet/buyImpulse', id: item.id })}>
                      Buy
                    </Button>
                  )}
                  <Button size="sm" variant="tinted" onClick={() => dispatch({ type: 'wallet/skipImpulse', id: item.id })}>
                    Skip
                  </Button>
                </>
              }
            />
          );
        })}
      </Group>

      {decided.length > 0 && (
        <Group header="Decided">
          {decided.map((item) => (
            <Row
              key={item.id}
              title={item.title}
              muted
              subtitle={item.status === 'skipped' ? `Skipped · saved ${money(state, item.price)}` : `Bought · ${money(state, item.price)}`}
              trailing={
                <IconButton label={`Remove ${item.title}`} onClick={() => dispatch({ type: 'wallet/deleteImpulse', id: item.id })}>
                  <X className="h-4 w-4" />
                </IconButton>
              }
            />
          ))}
        </Group>
      )}
    </>
  );
}

function TrendsSection() {
  const { state } = useStore();
  const week = lastDays(state, 7);
  const total = week.reduce((a, d) => a + d.spent, 0);
  const under = week.filter((d) => d.spent <= state.budget.daily).length;
  const weekKeys = new Set(week.map((d) => d.dayKey));
  const byCat = CATEGORIES.map((c) => ({
    c,
    v: state.expenses.filter((e) => e.category === c && weekKeys.has(e.dayKey)).reduce((a, e) => a + e.amount, 0),
  }));
  const maxCat = Math.max(1, ...byCat.map((x) => x.v));

  return (
    <>
      <Card className="mb-4">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.02em] text-secondary">Last 7 days</p>
            <p className="text-[30px] font-bold tracking-[-0.02em]">{money(state, total)}</p>
          </div>
          <p className="text-[14px] text-secondary">{under}/7 days on budget</p>
        </div>
        <BarChart
          data={week.map((d, i) => ({ label: WEEKDAY[new Date(d.dayKey + 'T12:00').getDay()], value: d.spent, highlight: i === week.length - 1 }))}
          goal={state.budget.daily}
          format={(v) => money(state, v)}
        />
      </Card>

      <Card className="mb-7">
        <p className="mb-3 text-[15px] font-semibold">Where it went</p>
        <div className="space-y-3">
          {byCat.map(({ c, v }, i) => (
            <div key={c}>
              <div className="mb-1 flex justify-between text-[14px]">
                <span>{c}</span>
                <span className="tabular text-secondary">{money(state, v)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-fill">
                <motion.div className="h-full rounded-full bg-accent" style={{ opacity: 1 - i * 0.18 }} initial={{ width: 0 }} animate={{ width: `${(v / maxCat) * 100}%` }} transition={{ ...softSpring, delay: i * 0.06 }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
