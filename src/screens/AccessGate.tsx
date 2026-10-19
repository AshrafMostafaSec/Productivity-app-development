import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Anchor, LockKeyhole, FolderOpen } from 'lucide-react';
import { LocalAccess, MAX_ENCRYPTED_BYTES } from '../services/localAccess';
import Button from '../ui/Button';
import Field from '../ui/Field';
import Group from '../ui/Group';

export default function AccessGate({ access, children }: { access: LocalAccess; children: ReactNode }) {
  const view = useSyncExternalStore(access.subscribe, access.getSnapshot);
  const [name, setName] = useState(''); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [raw, setRaw] = useState<string | null>(null); const [restorePassword, setRestorePassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => { void access.initialize(); }, [access]);
  const run = async (job: () => Promise<unknown>) => { setBusy(true); setError(null); try { await job(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); setPassword(''); setConfirmation(''); setRestorePassword(''); } };
  if (view.stage === 'open') return <div key={view.generation}>{children}</div>;
  if (view.stage === 'loading') return <main className="flex min-h-dvh items-center justify-center bg-canvas" role="status">Opening AnchorOS…</main>;
  return <main className="min-h-dvh bg-canvas px-5 py-10"><div className="mx-auto max-w-md">
    <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white"><Anchor aria-hidden className="h-8 w-8" /></div>
    <h1 className="text-[30px] font-bold tracking-tight">{view.stage === 'locked' ? `Welcome back, ${view.name}` : 'Your day, your space'}</h1>
    <p className="mb-7 mt-2 text-[15px] text-secondary">{view.stage === 'setup' ? 'Choose your name and a password. Your activities stay on this device. Encrypted file backups help you restore them after reinstalling.' : 'Unlock your local profile to continue.'}</p>
    {(error || view.error) && <p role="alert" className="mb-5 rounded-xl bg-card p-4 text-danger">{error ?? view.error}</p>}
    {view.stage === 'error' ? <Button onClick={() => void run(access.retry)} disabled={busy}>Try again</Button> : <form onSubmit={e => { e.preventDefault(); void run(async () => {
      if (view.stage === 'setup') { if (password !== confirmation) throw new Error('The passwords do not match.'); await access.create(name, password); }
      else await access.unlock(password);
    }); }}>
      <Group>
        {view.stage === 'setup' && <Field label="Your name" autoComplete="given-name" maxLength={80} value={name} onChange={e => setName(e.target.value)} required />}
        <Field label="Password" type="password" autoComplete={view.stage === 'setup' ? 'new-password' : 'current-password'} minLength={view.stage === 'setup' ? 8 : undefined} maxLength={256} value={password} onChange={e => setPassword(e.target.value)} required />
        {view.stage === 'setup' && <Field label="Confirm password" type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} required />}
      </Group>
      {view.stage === 'setup' && <p className="mb-5 text-[13px] text-secondary">Use at least 8 characters. Keep this password: it also opens your encrypted backups. There is no password reset service.</p>}
      <Button block disabled={busy} icon={<LockKeyhole className="h-4 w-4" />}>{busy ? 'Opening…' : view.stage === 'setup' ? 'Create local profile' : 'Unlock'}</Button>
    </form>}
    <section className="mt-9 border-t border-separator pt-6">
      <h2 className="mb-2 flex items-center gap-2 text-[18px] font-semibold"><FolderOpen className="h-5 w-5 text-accent" />Restore from a backup</h2>
      <p className="mb-4 text-[14px] text-secondary">After reinstalling, choose a saved .anchorbackup file from Files and enter its original password. Review it before replacing device data.</p>
      <label className="block text-[14px]">Encrypted backup file<input aria-label="Encrypted backup file" type="file" accept=".anchorbackup,.json,application/json" disabled={busy} className="my-3 block w-full text-[13px]" onChange={e => { const file = e.target.files?.[0]; if (file) void run(async () => { if (file.size > MAX_ENCRYPTED_BYTES) throw new Error('Choose a backup smaller than 16 MB.'); access.cancelRestore(); setRaw(await file.text()); }); e.currentTarget.value = ''; }} /></label>
      {raw && <><Group><Field label="Backup password" type="password" autoComplete="off" value={restorePassword} onChange={e => setRestorePassword(e.target.value)} /></Group><Button variant="tinted" disabled={busy || !restorePassword} onClick={() => void run(() => access.previewRestore(raw, restorePassword))}>Review backup</Button></>}
      {view.preview && <div className="mt-4 space-y-3 rounded-xl bg-card p-4"><p className="font-semibold">Restore {view.preview.name}’s activities?</p><p className="text-[14px] text-secondary">{view.preview.snapshot.payload.routines.length} routines · {view.preview.snapshot.payload.assignments.length} assignments · {view.preview.snapshot.payload.expenses.length} expenses. This replaces the current device profile. Keep the original backup file.</p><Button disabled={busy} onClick={() => void run(access.confirmRestore)}>Confirm restore</Button><Button variant="plain" onClick={access.cancelRestore}>Cancel restore</Button></div>}
    </section>
  </div></main>;
}
