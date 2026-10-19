import { useEffect, useState } from 'react';
import { AlarmClock, Bell, Clock, Timer, Trash2 } from 'lucide-react';
import type { Alarm } from '../../types';
import { useStore } from '../../state/store';
import { clearState } from '../../state/storage';
import { format12 } from '../../lib/time';
import { chime, notificationPermission, requestNotificationPermission, systemNotify, type PermissionState } from '../../lib/notify';
import Sheet from '../../ui/Sheet';
import Group from '../../ui/Group';
import Row from '../../ui/Row';
import Toggle from '../../ui/Toggle';
import Button from '../../ui/Button';
import Segmented from '../../ui/Segmented';
import Field from '../../ui/Field';
import IconTile from '../../ui/IconTile';
import PrayerTimesSheet from '../deen/PrayerTimesSheet';
import PomodoroSettingsSheet from '../focus/PomodoroSettingsSheet';

const PERMISSION_COPY: Record<PermissionState, string> = {
  granted: 'On — reminders also arrive when the app is in the background.',
  default: 'Allow notifications to get reminders when the app isn’t open on screen.',
  denied: 'Blocked in your browser settings. In-app banners and sounds still work.',
  unsupported: 'This browser doesn’t support notifications. Add AnchorOS to your Home Screen for full support.',
};

export default function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [permission, setPermission] = useState<PermissionState>(notificationPermission());
  const [timesOpen, setTimesOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<Alarm | 'new' | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const n = state.notifications;

  useEffect(() => {
    if (open) setPermission(notificationPermission());
  }, [open]);

  const toggle = (key: keyof typeof n) => dispatch({ type: 'notify/settings', patch: { [key]: !n[key] } });

  return (
    <Sheet open={open} onClose={onClose} title="Settings" hideCancel tall>
      <Group header="Notifications" footer={PERMISSION_COPY[permission]}>
        <Row
          leading={<IconTile><Bell className="h-4 w-4" /></IconTile>}
          title="System notifications"
          trailing={
            permission === 'granted' ? (
              <Button
                size="sm"
                variant="gray"
                onClick={() => {
                  if (n.sound) chime();
                  systemNotify('AnchorOS', 'Notifications are working.', 'test');
                }}
              >
                Test
              </Button>
            ) : permission === 'default' ? (
              <Button size="sm" onClick={async () => setPermission(await requestNotificationPermission())}>
                Allow
              </Button>
            ) : (
              <span className="text-[15px] text-secondary">{permission === 'denied' ? 'Blocked' : 'N/A'}</span>
            )
          }
        />
        <Row title="Prayer times" subtitle="At adhan, and a nudge 20 min later" trailing={<Toggle label="Prayer reminders" checked={n.prayers} onChange={() => toggle('prayers')} />} />
        <Row title="Pomodoro" subtitle="When a block or break ends" trailing={<Toggle label="Pomodoro alerts" checked={n.pomodoro} onChange={() => toggle('pomodoro')} />} />
        <Row title="Deadlines" subtitle="9:00 AM if something is due soon" trailing={<Toggle label="Deadline reminders" checked={n.deadlines} onChange={() => toggle('deadlines')} />} />
        <Row title="Cooled-off purchases" subtitle="When the wait timer ends" trailing={<Toggle label="Wallet reminders" checked={n.wallet} onChange={() => toggle('wallet')} />} />
        <Row title="Sounds" trailing={<Toggle label="Sounds" checked={n.sound} onChange={() => toggle('sound')} />} />
      </Group>

      <Group
        header="Alarms"
        headerAction={
          <button onClick={() => setEditingAlarm('new')} className="text-[15px] text-accent">
            Add
          </button>
        }
        footer="Math mission: solve 3 sums to stop it, so your brain is awake before you can fall back asleep. Alarms ring while AnchorOS is open."
      >
        {state.alarms.map((a) => (
          <Row
            key={a.id}
            leading={<IconTile tone={a.enabled ? 'accent' : 'gray'}><AlarmClock className="h-4 w-4" /></IconTile>}
            title={<span className="tabular text-[22px] font-light tracking-[-0.02em]">{format12(a.time)}</span>}
            subtitle={`${a.label} · ${a.mission === 'math' ? 'Math mission' : 'Tap to stop'}`}
            onClick={() => setEditingAlarm(a)}
            trailing={<Toggle label={`${a.label} alarm`} checked={a.enabled} onChange={() => dispatch({ type: 'alarm/update', id: a.id, patch: { enabled: !a.enabled } })} />}
          />
        ))}
        <Row title="Test alarm now" accent onClick={() => state.alarms[0] && dispatch({ type: 'alarm/ring', id: state.alarms[0].id, test: true })} />
      </Group>

      <Group header="Routine">
        <Row leading={<IconTile><Clock className="h-4 w-4" /></IconTile>} title="Prayer times" onClick={() => setTimesOpen(true)} chevron />
        <Row
          leading={<IconTile><Timer className="h-4 w-4" /></IconTile>}
          title="Pomodoro timer"
          subtitle={`${state.pomodoroSettings.focus} / ${state.pomodoroSettings.short} / ${state.pomodoroSettings.long} min`}
          onClick={() => setTimerOpen(true)}
          chevron
        />
      </Group>

      <Group header="Data" footer="Everything is stored only on this device. Nothing is uploaded.">
        {confirmReset ? (
          <Row
            title="Tap again to erase everything"
            destructive
            onClick={() => {
              clearState();
              dispatch({ type: 'system/reset' });
              setConfirmReset(false);
              onClose();
            }}
            trailing={
              <Button size="sm" variant="gray" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            }
          />
        ) : (
          <Row leading={<IconTile tone="gray"><Trash2 className="h-4 w-4" /></IconTile>} title="Reset all data" destructive onClick={() => setConfirmReset(true)} />
        )}
      </Group>

      <PrayerTimesSheet open={timesOpen} onClose={() => setTimesOpen(false)} />
      <PomodoroSettingsSheet open={timerOpen} onClose={() => setTimerOpen(false)} />
      <AlarmEditSheet alarm={editingAlarm} onClose={() => setEditingAlarm(null)} />
    </Sheet>
  );
}

function AlarmEditSheet({ alarm, onClose }: { alarm: Alarm | 'new' | null; onClose: () => void }) {
  const { dispatch } = useStore();
  const [time, setTime] = useState('05:00');
  const [label, setLabel] = useState('');
  const [mission, setMission] = useState<Alarm['mission']>('math');
  const isNew = alarm === 'new';

  useEffect(() => {
    if (!alarm) return;
    if (alarm === 'new') {
      setTime('05:00');
      setLabel('Alarm');
      setMission('math');
    } else {
      setTime(alarm.time);
      setLabel(alarm.label);
      setMission(alarm.mission);
    }
  }, [alarm]);

  const save = () => {
    if (isNew) dispatch({ type: 'alarm/add', time, label: label.trim() || 'Alarm', mission });
    else if (alarm) dispatch({ type: 'alarm/update', id: alarm.id, patch: { time, label: label.trim() || 'Alarm', mission } });
    onClose();
  };

  return (
    <Sheet open={!!alarm} onClose={onClose} title={isNew ? 'New Alarm' : 'Edit Alarm'} action={{ label: 'Save', onClick: save }}>
      <div className="mb-6 flex justify-center">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Alarm time" className="tabular rounded-[14px] bg-card px-5 py-3 text-[44px] font-light outline-none" />
      </div>
      <Group>
        <Field label="Label" value={label} onChange={(e) => setLabel(e.target.value)} className="text-right" />
      </Group>
      <Group header="Wake-up mission">
        <div className="ios-row p-2">
          <Segmented label="Mission" value={mission} onChange={setMission} options={[{ value: 'math', label: 'Solve math' }, { value: 'tap', label: 'Just tap' }]} />
        </div>
      </Group>
      {!isNew && alarm && (
        <Group>
          <Row
            title="Delete alarm"
            destructive
            onClick={() => {
              dispatch({ type: 'alarm/delete', id: alarm.id });
              onClose();
            }}
          />
        </Group>
      )}
    </Sheet>
  );
}
