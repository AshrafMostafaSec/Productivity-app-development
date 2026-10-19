import type { CloudFile } from '../services/googleDrive';
/** Keep 20 newest copies plus the newest copy of each UTC day for the last 30 days. */
export function retentionCandidates(files: CloudFile[], now = Date.now()): CloudFile[] {
  const sorted = [...files].sort((a, b) => Date.parse(b.createdTime) - Date.parse(a.createdTime));
  const days = new Set<string>();
  return sorted.filter((file, i) => {
    const at = Date.parse(file.createdTime);
    if (!Number.isFinite(at) || file.appProperties?.format !== '1') return false;
    const key = new Date(at).toISOString().slice(0, 10);
    const keepDaily = now - at <= 30 * 86400_000 && !days.has(key);
    days.add(key);
    return i >= 20 && !keepDaily;
  });
}
