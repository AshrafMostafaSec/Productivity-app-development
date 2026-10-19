import { useEffect, useState } from 'react';
import type { ExpenseCategory } from '../../types';
import { useStore } from '../../state/store';
import { money, safeToSpend } from '../../state/selectors';
import Sheet from '../../ui/Sheet';
import Group from '../../ui/Group';
import Field from '../../ui/Field';
import Segmented from '../../ui/Segmented';
import Button from '../../ui/Button';

const CATEGORIES: ExpenseCategory[] = ['Food', 'Study', 'Transport', 'Personal'];

interface Props {
  open: boolean;
  onClose: () => void;
  onPauseInstead: (title: string, price: string) => void;
}

export default function AddExpenseSheet({ open, onClose, onPauseInstead }: Props) {
  const { state, dispatch } = useStore();
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Food');

  useEffect(() => {
    if (open) {
      setAmount('');
      setTitle('');
      setCategory('Food');
    }
  }, [open]);

  const value = parseFloat(amount);
  const valid = value > 0 && title.trim().length > 0;
  const safe = safeToSpend(state);
  const overBudget = value > 0 && value > safe;

  const save = () => {
    if (!valid) return;
    dispatch({ type: 'wallet/addExpense', title: title.trim(), amount: Math.round(value * 100) / 100, category });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Log Expense" action={{ label: 'Add', onClick: save, disabled: !valid }}>
      <div className="mb-6 flex items-baseline justify-center gap-1 py-4">
        <span className="text-[34px] font-semibold text-secondary">{state.budget.currency}</span>
        <input
          autoFocus
          inputMode="decimal"
          placeholder="0"
          aria-label="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          className="tabular w-40 bg-transparent text-[56px] font-bold tracking-[-0.03em] outline-none placeholder:text-tertiary"
        />
      </div>
      <Group>
        <Field placeholder="What was it?" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </Group>
      <Group header="Category">
        <div className="ios-row p-2">
          <Segmented label="Category" value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
        </div>
      </Group>
      {overBudget && (
        <div className="rounded-[12px] bg-card p-4">
          <p className="text-[15px] leading-snug">
            This is more than your {money(state, Math.max(0, safe))} left today. Want to sleep on it?
          </p>
          <Button variant="tinted" block className="mt-3" onClick={() => onPauseInstead(title, amount)}>
            Pause for 24 hours instead
          </Button>
        </div>
      )}
    </Sheet>
  );
}
