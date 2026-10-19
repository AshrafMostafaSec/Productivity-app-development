import { useEffect, useState } from 'react';
import { useStore } from '../../state/store';
import Sheet from '../../ui/Sheet';
import Group from '../../ui/Group';
import Field from '../../ui/Field';

export default function BudgetSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [daily, setDaily] = useState('');
  const [currency, setCurrency] = useState('');

  useEffect(() => {
    if (open) {
      setDaily(String(state.budget.daily));
      setCurrency(state.budget.currency);
    }
  }, [open, state.budget]);

  const value = parseFloat(daily);
  const valid = value > 0 && currency.trim().length > 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Daily Budget"
      action={{
        label: 'Save',
        disabled: !valid,
        onClick: () => {
          dispatch({ type: 'wallet/setBudget', daily: value, currency: currency.trim() });
          onClose();
        },
      }}
    >
      <Group footer="Your daily budget resets every morning. Leftover money isn’t carried over, so the number stays simple.">
        <Field
          label="Amount"
          inputMode="decimal"
          value={daily}
          onChange={(e) => setDaily(e.target.value.replace(/[^0-9.]/g, ''))}
          className="text-right"
        />
        <Field label="Currency" value={currency} maxLength={4} onChange={(e) => setCurrency(e.target.value)} className="text-right" />
      </Group>
    </Sheet>
  );
}
