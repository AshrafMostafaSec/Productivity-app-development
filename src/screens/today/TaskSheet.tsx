import { Timer } from 'lucide-react';
import { useStore } from '../../state/store';
import { PRAYER_NAMES } from '../../lib/time';
import Sheet from '../../ui/Sheet';
import Group from '../../ui/Group';
import Row from '../../ui/Row';
import Check from '../../ui/Check';
import Button from '../../ui/Button';
import useSticky from '../../ui/useSticky';

export default function TaskSheet({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const live = state.routines.find((r) => r.id === taskId);
  const task = useSticky(live);
  if (!task) return null;

  const nextStep = task.steps.find((s) => !s.done);

  return (
    <Sheet open={!!live} onClose={onClose} title="Task" hideCancel>
      <div className="mb-6 px-1">
        <p className="text-[13px] font-semibold uppercase tracking-[0.02em] text-secondary">
          After {PRAYER_NAMES[task.anchor].en}
        </p>
        <h3 className="mt-0.5 text-[24px] font-bold leading-tight tracking-[-0.02em]">{task.title}</h3>
      </div>

      {nextStep && (
        <Button
          block
          size="lg"
          className="mb-8"
          icon={<Timer className="h-5 w-5" />}
          onClick={() => {
            dispatch({ type: 'pomo/start', minutes: 2, subject: 'Routine', task: nextStep.title });
            onClose();
          }}
        >
          Just start · 2 min
        </Button>
      )}

      <Group header="Steps">
        {task.steps.map((s) => (
          <Row
            key={s.id}
            leading={
              <Check checked={s.done} label={s.title} onChange={() => dispatch({ type: 'routine/toggleStep', taskId: task.id, stepId: s.id })} />
            }
            title={s.title}
            muted={s.done}
          />
        ))}
      </Group>

      <Group>
        <Row
          title="Delete task"
          destructive
          onClick={() => {
            dispatch({ type: 'routine/delete', taskId: task.id });
            onClose();
          }}
        />
      </Group>
    </Sheet>
  );
}
