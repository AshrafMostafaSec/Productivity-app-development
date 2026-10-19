import { useState } from 'react';
import { Cloud, Download, FileUp, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { useStore } from '../../state/store';
import { isIOS } from '../../platform/native';
import { exportText } from '../../platform/files';
import Sheet from '../../ui/Sheet';
import Group from '../../ui/Group';
import Row from '../../ui/Row';
import Button from '../../ui/Button';
import Toggle from '../../ui/Toggle';
import IconTile from '../../ui/IconTile';

export default function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { runtime, controller } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'device' | 'current' | 'rollback' | 'signout' | null>(null);
  const { cloud, account, preview } = runtime;
  const disabled = busy || runtime.working;
  const run = async (job: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await job(); setConfirm(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  };
  const status = runtime.storageError ? 'Not saved on device' : runtime.saving ? 'Saving on device…' : cloud.stage === 'uploading' ? 'Uploading backup…' : cloud.dirty && account ? (cloud.enabled ? 'Backup pending' : 'Saved on device · backup paused') : cloud.lastBackupAt ? `Backed up ${new Date(cloud.lastBackupAt).toLocaleString()}` : 'Saved on this device';
  return <Sheet open={open} onClose={onClose} title="Account & Backup" hideCancel tall>
    <Group header="Your data" footer="Keep a backup before deleting or re-signing the app. Only completed cloud backups can be restored after reinstalling.">
      <Row leading={<IconTile><ShieldCheck className="h-4 w-4" /></IconTile>} title={status} subtitle={runtime.storageError ?? 'Backups include tasks, study, prayer, settings, and spending.'} />
      {account && cloud.lastBackupAt && <Row title="Last cloud copy" subtitle={new Date(cloud.lastBackupAt).toLocaleString()} />}
      {runtime.storageError && <Row title="Retry saving" accent onClick={() => void run(controller.retrySave)} />}
    </Group>
    {(error || cloud.error) && <p role="alert" className="mb-4 rounded-xl bg-card p-4 text-[15px] text-danger">{error ?? cloud.error}</p>}
    <Group header="Google account" footer={account ? 'Your Google account has its own data on this device. Signing out keeps it here.' : isIOS() ? 'Sign in to keep backups in your Google Drive app storage.' : 'Google backup is available in the iPhone app. Local export and import work here.'}>
      <Row leading={<IconTile><UserRound className="h-4 w-4" /></IconTile>} title={account?.name || 'No account connected'} subtitle={account?.email ?? undefined} />
      {!account ? <Row title="Sign in with Google" trailing={<Button disabled={disabled || !runtime.configured} onClick={() => void run(controller.connect)}>Sign in</Button>} /> : <>
        <Row title="Automatic backup" trailing={<Toggle label="Automatic Google backup" checked={cloud.enabled} onChange={() => { if (!disabled) void run(() => controller.setAutoBackup(!cloud.enabled)); }} />} />
        <Row title="Check cloud copies" trailing={<Button variant="gray" size="sm" disabled={disabled || cloud.stage === 'uploading'} onClick={() => void run(controller.checkCloud)}><RefreshCw className="mr-1 h-4 w-4" />Check</Button>} />
        <Row title="Sign out" onClick={() => setConfirm('signout')} chevron />
      </>}
      {isIOS() && !runtime.configured && <Row title="Google sign-in is not set up" subtitle="This build supports offline use. Export a portable backup until Google sign-in is configured." />}
    </Group>
    {account && cloud.stage === 'choice' && <Group header="Choose your starting data" footer="Your cloud history stays available. A new install never replaces it automatically. Export anything you want to keep first.">
      {cloud.files.length > 0 && <Row title="Restore a cloud copy below" subtitle="Choose a date, review the data, then confirm." />}
      <Row title="Use this account’s device data" subtitle="Keep the data currently shown in the app." accent onClick={() => setConfirm('current')} />
      <Row title="Use my offline device data" subtitle="Copy the separate offline data into this Google account." accent onClick={() => setConfirm('device')} />
    </Group>}
    {account && <Group header="Cloud backup" footer="Changes upload after a short pause, on return to the app, and when the connection returns. Hourly checks run while the app is active. Background timing depends on iOS.">
      <Row leading={<IconTile><Cloud className="h-4 w-4" /></IconTile>} title="Back up now" trailing={<Button size="sm" disabled={disabled || cloud.stage === 'choice' || cloud.stage === 'checking' || cloud.stage === 'uploading' || !!runtime.storageError} onClick={() => void run(() => controller.backupNow(true))}>Back up</Button>} />
      {cloud.stage === 'checking' && <Row title="Checking Google Drive…" />}
      {cloud.files.slice(0, 20).map(file => <Row key={file.id} title={new Date(file.createdTime).toLocaleString()} subtitle="Tap to review this copy" chevron onClick={() => { if (!disabled) void run(() => controller.previewCloud(file.id)); }} />)}
      {cloud.files.length === 0 && cloud.stage !== 'checking' && <Row title="No cloud copies found yet" />}
    </Group>}
    {preview && <Group header="Review before restoring" footer="This replaces the current device data. A rollback copy is kept. Automatic backup pauses until you enable it again.">
      <Row title={new Date(preview.snapshot.createdAt).toLocaleString()} subtitle={`${preview.snapshot.payload.routines.length} routines · ${preview.snapshot.payload.assignments.length} assignments · ${preview.snapshot.payload.expenses.length} expenses · ${preview.snapshot.payload.studyLog.length} study sessions`} />
      <Row title="Confirm restore" trailing={<Button disabled={disabled} onClick={() => void run(controller.restorePreview)}>Restore</Button>} />
      <Row title="Cancel restore" onClick={controller.dismissPreview} />
    </Group>}
    <Group header="Portable backup" footer="Export files contain your personal data. Save them somewhere private. Imports are checked before you confirm a restore.">
      <Row leading={<IconTile><Download className="h-4 w-4" /></IconTile>} title="Export a backup" onClick={() => void run(async () => exportText(await controller.exportData()))} chevron />
      <div className="ios-row rounded-b-2xl bg-card px-4 py-3"><label className="flex items-center gap-3 text-[17px]"><FileUp className="h-5 w-5 text-accent" />Import a backup<input aria-label="Import a backup" className="min-w-0 flex-1 text-[12px]" type="file" accept="application/json,.json" disabled={disabled} onChange={e => { const file = e.target.files?.[0]; if (file) void run(async () => { if (file.size > 8 * 1024 * 1024) throw new Error('Choose a file smaller than 8 MB.'); await controller.previewImport(await file.text()); }); e.currentTarget.value = ''; }} /></label></div>
      <Row title="Restore previous device data" onClick={() => setConfirm('rollback')} chevron />
    </Group>
    {confirm && <Group header="Please confirm" footer={confirm === 'signout' ? 'Your account data and cloud history will be kept. The offline data will open.' : confirm === 'rollback' ? 'The previous device data will replace the current one. Automatic backup will pause.' : 'This choice allows your selected data to become the next cloud backup. Previous cloud copies remain available.'}>
      <Row title={confirm === 'signout' ? 'Sign out of Google?' : confirm === 'rollback' ? 'Restore previous device data?' : 'Use the selected device data?'} />
      <Row title="Confirm" trailing={<Button disabled={disabled} onClick={() => void run(async () => { if (confirm === 'signout') await controller.signOut(); else if (confirm === 'rollback') await controller.restoreRollback(); else await controller.chooseLocal(confirm === 'device'); })}>Confirm</Button>} />
      <Row title="Cancel" onClick={() => setConfirm(null)} />
    </Group>}
  </Sheet>;
}
