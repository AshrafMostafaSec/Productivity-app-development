import { lazy, Suspense, useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { TabId } from './types';
import { StoreProvider, useStore, localAccess, makeController } from './state/store';
import AccessGate from './screens/AccessGate';
import { currentPrayer } from './lib/time';
import useNow from './lib/useNow';
import useScheduler from './hooks/useScheduler';
import useNativeReminders from './hooks/useNativeReminders';
import PhoneFrame from './shell/PhoneFrame';
import TabBar from './shell/TabBar';
import LiveActivity from './shell/LiveActivity';
import { OverlayProvider } from './ui/overlay';
import Toast from './ui/Toast';
import TodayScreen from './screens/today/TodayScreen';
import AlarmOverlay from './screens/AlarmOverlay';
import Onboarding from './screens/Onboarding';

const DeenScreen = lazy(() => import('./screens/deen/DeenScreen'));
const FocusScreen = lazy(() => import('./screens/focus/FocusScreen'));
const WalletScreen = lazy(() => import('./screens/wallet/WalletScreen'));
const InsightsSheet = lazy(() => import('./screens/more/InsightsSheet'));
const SettingsSheet = lazy(() => import('./screens/more/SettingsSheet'));

function AnchorOS() {
  const { state, runtime, controller } = useStore();
  const now = useNow();
  const [tab, setTab] = useState<TabId>('today');
  const [insights, setInsights] = useState(false);
  const [settings, setSettings] = useState(false);
  useScheduler();
  const reminderError = useNativeReminders();

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
          <Suspense fallback={<div role="status" className="p-8 text-secondary">Opening…</div>}>
          {tab === 'today' && <TodayScreen onNavigate={setTab} onOpenInsights={() => setInsights(true)} onOpenSettings={() => setSettings(true)} />}
          {tab === 'deen' && <DeenScreen />}
          {tab === 'focus' && <FocusScreen />}
          {tab === 'wallet' && <WalletScreen />}
          </Suspense>
        </motion.main>
      </AnimatePresence>
      <LiveActivity hidden={tab === 'focus'} onOpen={() => setTab('focus')} />
      <TabBar active={tab} onChange={setTab} badges={{ deen: prayerPending }} />
      <Suspense fallback={null}>
      <InsightsSheet open={insights} onClose={() => setInsights(false)} />
      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
      </Suspense>
      <AlarmOverlay />
      <AnimatePresence>{!state.onboarded && <Onboarding key="onboarding" />}</AnimatePresence>
      <Toast />
      {runtime.working && <div role="status" className="absolute inset-0 z-[90] flex items-center justify-center bg-canvas/80 p-8"><p className="rounded-xl bg-card p-5 text-secondary shadow">Opening your account data…</p></div>}
      {reminderError && <button className="absolute left-3 right-3 top-3 z-[65] rounded-xl bg-card p-3 text-[13px] text-secondary shadow" onClick={() => setSettings(true)}>{reminderError}</button>}
      {runtime.storageError && <div role="alert" className="absolute left-3 right-3 top-3 z-[100] rounded-xl bg-card p-4 text-[13px] shadow-lg"><p className="text-danger">{runtime.storageError}</p><button className="mt-2 text-accent" onClick={() => void controller.retrySave().catch(() => {})}>Retry saving</button></div>}
    </OverlayProvider>
  );
}

function UnlockedApp() {
  const controller = useMemo(() => makeController(localAccess), []);
  return (
    <StoreProvider controller={controller} access={localAccess}>
      <PhoneFrame>
        <AnchorOS />
      </PhoneFrame>
    </StoreProvider>
  );
}

export default function App() { return <AccessGate access={localAccess}><UnlockedApp /></AccessGate>; }
