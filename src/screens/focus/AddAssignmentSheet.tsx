import { useEffect, useState } from 'react';
import { useStore } from '../../state/store';
import { addDays } from '../../lib/time';
import Sheet from '../../ui/Sheet';
import Group from '../../ui/Group';
import Field from '../../ui/Field';

export default function AddAssignmentSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useStore();
  const [course, setCourse] = useState('');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(addDays(3));
  const [firstStep, setFirstStep] = useState('');

  useEffect(() => {
    if (open) {
      setCourse('');
      setTitle('');
      setDueDate(addDays(3));
      setFirstStep('');
    }
  }, [open]);

  const valid = course.trim() && title.trim() && dueDate;
  const save = () => {
    if (!valid) return;
    dispatch({ type: 'uni/add', course: course.trim(), title: title.trim(), dueDate, firstStep: firstStep.trim() });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="New Deadline" action={{ label: 'Add', onClick: save, disabled: !valid }}>
      <Group>
        <Field autoFocus label="Course" placeholder="CS 302" value={course} onChange={(e) => setCourse(e.target.value)} />
        <Field label="Title" placeholder="Problem set 5" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Field label="Due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="text-right" />
      </Group>
      <Group header="First tiny step" footer="Something you could do in two minutes, like opening the brief.">
        <Field placeholder="Open the assignment brief" value={firstStep} onChange={(e) => setFirstStep(e.target.value)} />
      </Group>
    </Sheet>
  );
}
