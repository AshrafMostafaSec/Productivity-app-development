import { useState } from 'react';
import { Timer } from 'lucide-react';
import { useStore } from '../../state/store';
import { dueLabel } from '../../lib/time';
import Sheet from '../../ui/Sheet';
import Group from '../../ui/Group';
import Row from '../../ui/Row';
import Check from '../../ui/Check';
import Button from '../../ui/Button';
import useSticky from '../../ui/useSticky';

export default function AssignmentSheet({ id, onClose, onStudy }: { id: string | null; onClose: () => void; onStudy: () => void }) {
  const { state, dispatch } = useStore();
  const [newStep, setNewStep] = useState('');
  const live = state.assignments.find((x) => x.id === id);
  const a = useSticky(live);
  if (!a) return null;

  const next = a.steps.find((s) => !s.done);
  const addStep = () => {
    const title = newStep.trim();
    if (!title) return;
    dispatch({ type: 'uni/addStep', id: a.id, title });
    setNewStep('');
  };
  const [y, m, d] = a.dueDate.split('-').map(Number);
  const dateText = new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <Sheet open={!!live} onClose={onClose} title={a.course} hideCancel>
      <div className="mb-6 px-1">
        <h3 className="text-[24px] font-bold leading-tight tracking-[-0.02em]">{a.title}</h3>
        <p className="mt-1 text-[15px] text-secondary">
          {dueLabel(a.dueDate)} · {dateText}
        </p>
      </div>

      {next && (
        <Button
          block
          size="lg"
          className="mb-8"
          icon={<Timer className="h-5 w-5" />}
          onClick={() => {
            dispatch({ type: 'pomo/start', subject: a.course, task: next.title });
            onClose();
            onStudy();
          }}
        >
          Pomodoro on next step
        </Button>
      )}

      <Group header="Steps" footer="Each step should take under 25 minutes. If it doesn’t, split it.">
        {a.steps.map((s) => (
          <Row
            key={s.id}
            leading={<Check checked={s.done} label={s.title} onChange={() => dispatch({ type: 'uni/toggleStep', id: a.id, stepId: s.id })} />}
            title={s.title}
            muted={s.done}
          />
        ))}
        <div className="ios-row flex items-center pl-4">
          <div className="ios-row-content flex flex-1 items-center gap-2 pr-2">
            <input
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addStep()}
              placeholder="Add a step"
              aria-label="New step"
              className="min-w-0 flex-1 bg-transparent py-[11px] text-[17px] outline-none placeholder:text-tertiary"
            />
            <Button size="sm" variant="tinted" onClick={addStep} disabled={!newStep.trim()}>
              Add
            </Button>
          </div>
        </div>
      </Group>

      <Group>
        <Row
          title="Delete deadline"
          destructive
          onClick={() => {
            dispatch({ type: 'uni/delete', id: a.id });
            onClose();
          }}
        />
      </Group>
    </Sheet>
  );
}
