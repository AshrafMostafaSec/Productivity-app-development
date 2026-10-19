import { useEffect, useState } from 'react';
import type { PrayerId } from '../../types';
import { useStore } from '../../state/store';
import { PRAYER_NAMES, PRAYER_ORDER } from '../../lib/time';
import Sheet from '../../ui/Sheet';
import Group from '../../ui/Group';
import Field from '../../ui/Field';
import Segmented from '../../ui/Segmented';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultAnchor: PrayerId;
}

export default function AddTaskSheet({ open, onClose, defaultAnchor }: Props) {
  const { dispatch } = useStore();
  const [title, setTitle] = useState('');
  const [anchor, setAnchor] = useState<PrayerId>(defaultAnchor);
  const [starter, setStarter] = useState('');

  useEffect(() => {
    if (open) {
      setTitle('');
      setStarter('');
      setAnchor(defaultAnchor);
    }
  }, [open, defaultAnchor]);

  const save = () => {
    if (!title.trim()) return;
    dispatch({ type: 'routine/add', title: title.trim(), anchor, starter: starter.trim() });
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="New Task" action={{ label: 'Add', onClick: save, disabled: !title.trim() }}>
      <Group>
        <Field autoFocus placeholder="Task" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </Group>
      <Group header="Do it after" footer="Anchoring a task to a prayer gives your day fixed landmarks.">
        <div className="ios-row p-2">
          <Segmented
            label="Prayer anchor"
            value={anchor}
            onChange={setAnchor}
            options={PRAYER_ORDER.map((p) => ({ value: p, label: PRAYER_NAMES[p].en }))}
          />
        </div>
      </Group>
      <Group header="Tiny first step" footer="Make it so small it feels silly. Starting is the hard part.">
        <Field placeholder="e.g. Open the document" value={starter} onChange={(e) => setStarter(e.target.value)} />
      </Group>
    </Sheet>
  );
}
