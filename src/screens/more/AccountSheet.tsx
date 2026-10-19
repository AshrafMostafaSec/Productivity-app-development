import { useState } from 'react';
import { Download, FolderOpen, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { useStore } from '../../state/store';
import { isIOS } from '../../platform/native';
import { exportText } from '../../platform/files';
import { MAX_ENCRYPTED_BYTES } from '../../services/localAccess';
import Sheet from '../../ui/Sheet';
import Group from '../../ui/Group';
import Row from '../../ui/Row';
import Button from '../../ui/Button';
import Toggle from '../../ui/Toggle';
import IconTile from '../../ui/IconTile';

export default function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { runtime, controller, lock } = useStore();
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'device' | 'rollback' | null>(null);
  const { backup, account, preview, folder } = runtime;
  const disabled = busy || runtime.working;
  const run = async (job: () => Promise<unknown>) => {
    setBusy(true); setError(null); try { await job(); setConfirm(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  };
  const status = runtime.storageError ? 'Not saved on device' : runtime.saving ? 'Saving on device…' : backup.stage === 'uploading' ? 'Writing encrypted backup…' : backup.dirty && backup.enabled && folder.configured ? 'File backup pending' : backup.lastBackupAt ? `File backup verified ${new Date(backup.lastBackupAt).toLocaleString()}` : 'Saved on this device';
  return <Sheet open={open} onClose={onClose} title="Profile & Backups" hideCancel tall>
    <Group header="Your local profile" footer="Your password unlocks this profile and its encrypted backups. Keep it safe: there is no online password reset.">
      <Row leading={<IconTile><UserRound className="h-4 w-4" /></IconTile>} title={account?.name ?? 'Your profile'} subtitle="Local password access" />
      <Row leading={<IconTile><LockKeyhole className="h-4 w-4" /></IconTile>} title="Lock app" onClick={() => void run(lock)} />
    </Group>
    <Group header="Your activities">
      <Row leading={<IconTile><ShieldCheck className="h-4 w-4" /></IconTile>} title={status} subtitle="Routines, prayer, study history, expenses, settings, and activities are included." />
      {runtime.storageError && <Row title="Retry saving" accent onClick={() => void run(controller.retrySave)} />}
      {backup.dirty && !backup.enabled && <Row title="File backups paused" subtitle="Changes remain on this device until another backup succeeds." />}
    </Group>
    {(error || backup.error) && <p role="alert" className="mb-4 rounded-xl bg-card p-4 text-[15px] text-danger">{error ?? backup.error}</p>}
    <Group header="Automatic file backup" footer={isIOS() ? 'Choose a folder outside AnchorOS in Files. Copies in that folder can survive deleting this app. After reinstalling, choose a saved backup file and enter the same password. Files stored only inside this app are deleted with it.' : 'Automatic folder access is available in the iPhone app. Export an encrypted file below to keep a separate browser backup.'}>
      <Row leading={<IconTile><FolderOpen className="h-4 w-4" /></IconTile>} title={folder.name ?? 'No backup folder selected'} trailing={<Button size="sm" disabled={disabled || !isIOS()} onClick={() => void run(controller.selectFolder)}>Choose folder</Button>} />
      {folder.configured && <>
        <Row title="Automatic backup" trailing={<Toggle label="Automatic file backup" checked={backup.enabled} onChange={() => { if (!disabled) void run(() => controller.setAutoBackup(!backup.enabled)); }} />} />
        <Row title="Back up now" trailing={<Button size="sm" disabled={disabled || ['choice', 'checking', 'uploading'].includes(backup.stage) || !!runtime.storageError} onClick={() => void run(() => controller.backupNow(true))}>Back up</Button>} />
        <Row title="Check backup files" onClick={() => void run(controller.checkFolder)} chevron />
      </>}
    </Group>
    {folder.configured && backup.stage === 'choice' && <Group header="Review existing backups" footer="This folder already has backup history. Restore a copy below or confirm that the current device activities should become the next copy. Older copies are kept.">
      <Row title="Keep current device activities" accent onClick={() => setConfirm('device')} />
    </Group>}
    {backup.files.length > 0 && <Group header="Backup history" footer="Every file is decrypted and checked before you confirm a restore.">
      {backup.files.slice(0, 30).map(file => <Row key={file.id} title={new Date(file.createdTime).toLocaleString()} subtitle="Review this encrypted copy" chevron onClick={() => { if (!disabled) void run(() => controller.previewBackup(file.id)); }} />)}
    </Group>}
    <Group header="Keep a separate file" footer="Save the exported file outside AnchorOS. Your password is required to open it after reinstalling. Only successfully completed backups can restore later changes.">
      <Row leading={<IconTile><Download className="h-4 w-4" /></IconTile>} title="Export encrypted backup" onClick={() => void run(async () => exportText(await controller.exportData(), `AnchorOS-backup-${new Date().toISOString().slice(0, 10)}.anchorbackup`))} chevron />
      <div className="ios-row rounded-b-2xl bg-card px-4 py-3"><label className="block text-[16px]">Import a backup<input aria-label="Import a backup" className="mt-2 block w-full text-[12px]" type="file" accept=".anchorbackup,.json,application/json" disabled={disabled} onChange={e => { const file = e.target.files?.[0]; if (file) void run(async () => { if (file.size > MAX_ENCRYPTED_BYTES) throw new Error('Choose a backup smaller than 16 MB.'); await controller.previewImport(await file.text()); }); e.currentTarget.value = ''; }} /></label></div>
      <Row title="Restore previous device data" onClick={() => setConfirm('rollback')} chevron />
    </Group>
    {preview && <Group header="Review before restoring" footer="The current device activities will be replaced. A rollback copy is kept and automatic backup pauses.">
      <Row title={new Date(preview.snapshot.createdAt).toLocaleString()} subtitle={`${preview.snapshot.payload.routines.length} routines · ${preview.snapshot.payload.assignments.length} assignments · ${preview.snapshot.payload.expenses.length} expenses · ${preview.snapshot.payload.studyLog.length} study sessions`} />
      <Row title="Confirm restore" trailing={<Button disabled={disabled} onClick={() => void run(controller.restorePreview)}>Restore</Button>} />
      <Row title="Cancel restore" onClick={controller.dismissPreview} />
    </Group>}
    {confirm && <Group header="Please confirm" footer={confirm === 'rollback' ? 'This replaces the current activities with the previous device copy. File backups will pause.' : 'Current activities will become the next encrypted backup. Existing backup files will not be overwritten.'}>
      <Row title={confirm === 'rollback' ? 'Restore previous device data?' : 'Keep current device activities?'} />
      <Row title="Confirm" trailing={<Button disabled={disabled} onClick={() => void run(async () => { if (confirm === 'rollback') await controller.restoreRollback(); else { await controller.chooseLocal(false); await controller.backupNow(); } })}>Confirm</Button>} />
      <Row title="Cancel" onClick={() => setConfirm(null)} />
    </Group>}
  </Sheet>;
}
