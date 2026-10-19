import type { ShieldApp } from '../../types';
import { useStore } from '../../state/store';
import { REWARDS } from '../../state/rewards';
import Sheet from '../../ui/Sheet';
import Button from '../../ui/Button';
import IconTile from '../../ui/IconTile';
import useSticky from '../../ui/useSticky';

interface Props {
  app: ShieldApp | null;
  lockReason: string | null;
  onClose: () => void;
}

/** The pause screen shown when a locked app is opened. */
export default function InterceptSheet({ app, lockReason, onClose }: Props) {
  const { state, dispatch } = useStore();
  const shown = useSticky(app);
  if (!shown) return null;
  const live = state.apps.find((a) => a.id === shown.id) ?? shown;
  const canAfford = state.balance >= live.cost;
  const blocked = lockReason ?? (!canAfford ? `You need ${live.cost - state.balance} more minutes` : null);

  return (
    <Sheet open={!!app} onClose={onClose} title="" hideCancel>
      <div className="flex flex-col items-center px-2 pb-2 pt-4 text-center">
        <div className="scale-150">
          <IconTile tone="gray">{live.name[0]}</IconTile>
        </div>
        <h3 className="mt-6 text-[24px] font-bold tracking-[-0.02em]">Pause before {live.name}</h3>
        <p className="mt-2 max-w-[280px] text-[15px] leading-snug text-secondary">
          Take one breath. Is this what you actually want to do right now?
        </p>

        <div className="mt-8 w-full space-y-2.5">
          <Button
            block
            size="lg"
            onClick={() => {
              dispatch({ type: 'shield/resist', appId: live.id });
              onClose();
            }}
          >
            Close it · +{REWARDS.resistApp} min
          </Button>
          <Button
            block
            size="lg"
            variant="gray"
            disabled={!!blocked}
            onClick={() => {
              dispatch({ type: 'shield/unlock', appId: live.id });
              onClose();
            }}
          >
            Spend {live.cost} min for 15 min
          </Button>
          {blocked && <p className="pt-1 text-[13px] text-secondary">{blocked}</p>}
        </div>
      </div>
    </Sheet>
  );
}
