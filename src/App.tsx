import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { TabId } from './types';
import { StoreProvider, useStore } from './state/store';
import { currentPrayer } from './lib/time';
import useNow from './lib/useNow';
import useScheduler from './hooks/useScheduler';
import PhoneFrame from './shell/PhoneFrame';
import TabBar from './shell/TabBar';
import LiveActivity from './shell/LiveActivity';
import { OverlayProvider } from './ui/overlay';
import Toast from './ui/Toast';
import TodayScreen from './screens/today/TodayScreen';
import DeenScreen from './screens/deen/DeenScreen';
import FocusScreen from './screens/focus/FocusScreen';
import WalletScreen from './screens/wallet/WalletScreen';
import InsightsSheet from './screens/more/InsightsSheet';
import SettingsSheet from './screens/more/SettingsSheet';
import AlarmOverlay from './screens/AlarmOverlay';
import Onboarding from './screens/Onboarding';

function AnchorOS() {
  const { state } = useStore();
  const now = useNow();
  const [tab, setTab] = useState<TabId>('today');
  const [insights, setInsights] = useState(false);
  const [settings, setSettings] = useState(false);
  useScheduler();

  const current = currentPrayer(state.prayerTimes, now);
  const prayerPending = !!current && state.prayers[current].status === 'none';

  return (
    <OverlayProvider>
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={tab}
          className="h-full"
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.985 }}
          transition={{ duration: 0.16 }}
        >
          {tab === 'today' && <TodayScreen onNavigate={setTab} onOpenInsights={() => setInsights(true)} onOpenSettings={() => setSettings(true)} />}
          {tab === 'deen' && <DeenScreen />}
          {tab === 'focus' && <FocusScreen />}
          {tab === 'wallet' && <WalletScreen />}
        </motion.main>
      </AnimatePresence>
      <LiveActivity hidden={tab === 'focus'} onOpen={() => setTab('focus')} />
      <TabBar active={tab} onChange={setTab} badges={{ deen: prayerPending }} />
      <InsightsSheet open={insights} onClose={() => setInsights(false)} />
      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
      <AlarmOverlay />
      <AnimatePresence>{!state.onboarded && <Onboarding key="onboarding" />}</AnimatePresence>
      <Toast />
    </OverlayProvider>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <PhoneFrame>
        <AnchorOS />
      </PhoneFrame>
    </StoreProvider>
  );
}
