import { useEffect, useState } from 'react';
import { useStore } from '../../state/store';
import Sheet from '../../ui/Sheet';
import Group from '../../ui/Group';
import Field from '../../ui/Field';
import Segmented from '../../ui/Segmented';

interface Props {
  draft: { title: string; price: string } | null;
  onClose: () => void;
}

export default function AddImpulseSheet({ draft, onClose }: Props) {
  const { state, dispatch } = useStore();
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [trigger, setTrigger] = useState('');
  const [waitHours, setWaitHours] = useState(24);

  useEffect(() => {
    if (draft) {
      setTitle(draft.title);
      setPrice(draft.price);
      setTrigger('');
      setWaitHours(24);
    }
  }, [draft]);

  const value = parseFloat(price);
  const valid = title.trim().length > 0 && value > 0;
  const save = () => {
    if (!valid) return;
    dispatch({ type: 'wallet/addImpulse', title: title.trim(), price: value, trigger: trigger.trim(), waitHours });
    onClose();
  };

  return (
    <Sheet open={!!draft} onClose={onClose} title="Pause a Purchase" action={{ label: 'Pause', onClick: save, disabled: !valid }}>
      <Group>
        <Field autoFocus label="Item" placeholder="Wireless earbuds" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Field
          label="Price"
          inputMode="decimal"
          placeholder={`${state.budget.currency}0`}
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
        />
      </Group>
      <Group header="What made you want it?" footer="Naming the trigger (boredom, a video, stress) makes the urge easier to spot next time.">
        <Field placeholder="Optional" value={trigger} onChange={(e) => setTrigger(e.target.value)} />
      </Group>
      <Group header="Wait">
        <div className="ios-row p-2">
          <Segmented
            label="Wait time"
            value={waitHours}
            onChange={setWaitHours}
            options={[24, 48, 72].map((h) => ({ value: h, label: `${h} hours` }))}
          />
        </div>
      </Group>
    </Sheet>
  );
}
