import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Account } from '../storage/schema';

export interface NativeBridge {
  readData(): Promise<{ value: string | null }>;
  writeData(options: { value: string }): Promise<void>;
  readOriginalData(): Promise<{ value: string | null }>;
  preserveOriginalData(options: { value: string }): Promise<void>;
  readPreviousData(): Promise<{ value: string | null }>;
  googleStatus(): Promise<{ configured: boolean; account: Account | null }>;
  googleSignIn(): Promise<{ account: Account }>;
  googleAuthorizeDrive(): Promise<void>;
  googleToken(): Promise<{ accessToken: string; subject: string }>;
  googleSignOut(): Promise<void>;
}
export const Native = registerPlugin<NativeBridge>('AnchorNative');
export const isIOS = () => Capacitor.getPlatform() === 'ios';
