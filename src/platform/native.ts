import { Capacitor, registerPlugin } from '@capacitor/core';
export interface NativeBridge {
  readData(): Promise<{ value: string | null }>;
  writeData(options: { value: string }): Promise<void>;
  readOriginalData(): Promise<{ value: string | null }>;
  preserveOriginalData(options: { value: string }): Promise<void>;
  readPreviousData(): Promise<{ value: string | null }>;
  readAccessData(): Promise<{ value: string | null }>;
  writeAccessData(options: { value: string }): Promise<void>;
  deriveKey(options: { password: string; salt: string; iterations: number }): Promise<{ key: string }>;
  encrypt(options: { key: string; iv: string; plaintext: string; aad: string }): Promise<{ ciphertext: string }>;
  decrypt(options: { key: string; iv: string; ciphertext: string; aad: string }): Promise<{ plaintext: string }>;
  hash(options: { value: string }): Promise<{ hex: string }>;
  folderStatus(): Promise<{ configured: boolean; name: string | null; token: string | null }>;
  selectBackupFolder(): Promise<{ configured: boolean; name: string; token: string }>;
  listBackups(options: { token: string }): Promise<{ files: { id: string; name: string; size: string; createdTime: string; appProperties: Record<string, string> }[] }>;
  readBackup(options: { token: string; id: string }): Promise<{ value: string }>;
  writeBackup(options: { token: string; id: string; value: string }): Promise<void>;
  removeBackup(options: { token: string; id: string }): Promise<void>;
}
export const Native = registerPlugin<NativeBridge>('AnchorNative');
export const isIOS = () => Capacitor.getPlatform() === 'ios';
