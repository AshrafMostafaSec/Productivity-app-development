import type { PrayerId, PrayerLog } from '../../types';
import { useStore } from '../../state/store';
import { adhkarProgress } from '../../state/selectors';
import { PRAYER_NAMES, SUNNAH_RAWATIB, format12 } from '../../lib/time';
import Sheet from '../../ui/Sheet';
import Group from '../../ui/Group';
import Row from '../../ui/Row';
import Segmented from '../../ui/Segmented';
import Toggle from '../../ui/Toggle';
import useSticky from '../../ui/useSticky';

interface Props {
  prayer: PrayerId | null;
  onClose: () => void;
  onOpenAdhkar: (p: PrayerId) => void;
}

export default function PrayerSheet({ prayer, onClose, onOpenAdhkar }: Props) {
  const { state, dispatch } = useStore();
  const shown = useSticky(prayer);
  if (!shown) return null;
  const prayerId = shown;
  const day = state.prayers[prayerId];
  const prog = adhkarProgress(state, `after:${prayerId}`);
  const hasRawatib = prayerId !== 'asr';

  return (
    <Sheet open={!!prayer} onClose={onClose} title={PRAYER_NAMES[prayerId].en} hideCancel>
      <div className="mb-6 text-center">
        <p className="font-arabic text-[40px] leading-tight">{PRAYER_NAMES[prayerId].ar}</p>
        <p className="text-[15px] text-secondary">{format12(state.prayerTimes[prayerId])}</p>
      </div>
      <Group header="Status">
        <div className="ios-row p-2">
          <Segmented<PrayerLog>
            label="Prayer status"
            value={day.status}
            onChange={(status) => dispatch({ type: 'prayer/log', id: prayerId, status })}
            options={[
              { value: 'none', label: 'Not yet' },
              { value: 'on_time', label: 'On time' },
              { value: 'late', label: 'Late' },
            ]}
          />
        </div>
      </Group>
      <Group footer={hasRawatib ? undefined : 'Asr has no confirmed rawatib; 4 before is a recommended nafl.'}>
        <Row
          title="Sunnah prayer"
          subtitle={SUNNAH_RAWATIB[prayerId]}
          trailing={
            <Toggle label="Sunnah prayed" checked={day.sunnah} onChange={() => dispatch({ type: 'prayer/toggleSunnah', id: prayerId })} />
          }
        />
        <Row
          title="Adhkar after prayer"
          subtitle={prog.complete ? 'Done' : `${prog.done} of ${prog.total}`}
          onClick={() => onOpenAdhkar(prayerId)}
          chevron
        />
      </Group>
    </Sheet>
  );
}
