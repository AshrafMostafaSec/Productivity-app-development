import { Minus, Plus } from 'lucide-react';

interface StepperProps {
  onDecrement: () => void;
  onIncrement: () => void;
  label: string;
  canDecrement?: boolean;
}

export default function Stepper({ onDecrement, onIncrement, label, canDecrement = true }: StepperProps) {
  return (
    <div className="flex h-8 items-center rounded-[9px] bg-fill" role="group" aria-label={label}>
      <button
        aria-label={`Decrease ${label}`}
        onClick={onDecrement}
        disabled={!canDecrement}
        className="flex h-full w-[46px] items-center justify-center text-label disabled:text-tertiary"
      >
        <Minus className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <span className="h-[18px] w-px bg-separator" />
      <button
        aria-label={`Increase ${label}`}
        onClick={onIncrement}
        className="flex h-full w-[46px] items-center justify-center text-label"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}
