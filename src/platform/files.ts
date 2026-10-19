import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isIOS } from './native';
export async function exportText(text: string, filename = `AnchorOS-backup-${new Date().toISOString().slice(0, 10)}.json`) {
  if (isIOS()) {
    const saved = await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: 'AnchorOS backup', url: saved.uri, dialogTitle: 'Save your backup' });
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
