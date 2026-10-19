import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { App as NativeApp } from '@capacitor/app';
import { AppController, type AppView } from './controller';
import { Repository } from '../storage/repository';
import { deviceBackend } from '../storage/backend';
import { GoogleAuth } from '../services/googleAuth';
import { GoogleDrive } from '../services/googleDrive';
import { isIOS } from '../platform/native';
import type { Action, StoreState } from './reducer';
import { dayKeyOf } from '../lib/time';
import { exportText } from '../platform/files';

const auth = new GoogleAuth();
export const appController = new AppController(new Repository(deviceBackend(), () => localStorage.getItem('anchoros:v1')), auth, new GoogleDrive(auth));
interface StoreValue { state: StoreState; dispatch: (action: Action) => void; runtime: AppView; controller: AppController }
const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children, controller = appController }: { children: ReactNode; controller?: AppController }) {
  const runtime = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => {
    void controller.initialize();
    const resume = () => { if (!document.hidden) void controller.resume(); };
    const online = () => void controller.resume();
    const background = () => { if (document.hidden) void controller.backupNow(); };
    document.addEventListener('visibilitychange', resume);
    document.addEventListener('visibilitychange', background);
    window.addEventListener('online', online);
    const hourly = setInterval(resume, 3600_000);
    const rollover = setInterval(() => controller.dispatch({ type: 'system/rollover', dayKey: dayKeyOf() }), 60_000);
    const handle = isIOS() ? NativeApp.addListener('appStateChange', ({ isActive }) => { if (isActive) void controller.resume(); else void controller.backupNow(); }) : null;
    return () => {
      document.removeEventListener('visibilitychange', resume);
      document.removeEventListener('visibilitychange', background);
      window.removeEventListener('online', online);
      clearInterval(hourly); clearInterval(rollover);
      void handle?.then(h => h.remove());
    };
  }, [controller]);
  useEffect(() => {
    const toast = runtime.state.toast;
    if (!toast) return;
    const id = setTimeout(() => controller.dispatch({ type: 'toast/dismiss', toastId: toast.id }), 3000);
    return () => clearTimeout(id);
  }, [runtime.state.toast, controller]);
  if (!runtime.ready) return <div className="flex min-h-dvh items-center justify-center bg-canvas text-secondary" role="status">Opening your day…</div>;
  if (runtime.blocked) return <RecoveryScreen controller={controller} runtime={runtime} />;
  return <StoreContext.Provider value={{ state: runtime.state, dispatch: controller.dispatch, runtime, controller }}>{children}</StoreContext.Provider>;
}

function RecoveryScreen({ controller, runtime }: { controller: AppController; runtime: AppView }) {
  const run = (job: () => Promise<unknown>) => void job().catch(error => window.alert(error instanceof Error ? error.message : 'Please try again.'));
  return <main className="flex min-h-dvh items-center justify-center bg-canvas p-6"><div className="max-w-md space-y-5 rounded-2xl bg-card p-6">
    <h1 className="text-[24px] font-bold">Your saved data needs attention</h1>
    <p role="alert" className="text-secondary">{runtime.storageError}</p>
    <button className="block text-accent" onClick={() => run(() => controller.retryLoad())}>Try again</button>
    <button className="block text-accent" onClick={() => run(async () => exportText(await controller.exportOriginal(), 'AnchorOS-original-device-data.json'))}>Export original device file</button>
    <label className="block text-accent">Choose a backup to restore<input aria-label="Choose recovery backup" type="file" accept=".json,application/json" className="mt-2 block w-full text-secondary" onChange={e => { const file = e.target.files?.[0]; if (file) run(async () => { if (file.size > 8 * 1024 * 1024) throw new Error('Choose a backup smaller than 8 MB.'); await controller.previewImport(await file.text()); }); }} /></label>
    {runtime.preview && <div className="space-y-3"><p>Restore the copy from {new Date(runtime.preview.snapshot.createdAt).toLocaleString()}? Your original device file will be preserved.</p><button className="text-accent" onClick={() => run(() => controller.restorePreview())}>Confirm restore</button></div>}
  </div></main>;
}
export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
