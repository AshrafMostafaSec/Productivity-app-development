import { isIOS, Native } from '../platform/native';
import { profileSchema, type Account } from '../storage/schema';

export interface Auth {
  status(): Promise<{ configured: boolean; account: Account | null }>;
  signIn(): Promise<Account>;
  authorizeDrive(): Promise<void>;
  token(subject: string): Promise<string>;
  signOut(): Promise<void>;
}
export class GoogleAuth implements Auth {
  async status() {
    if (!isIOS()) return { configured: false, account: null };
    const result = await Native.googleStatus();
    return { configured: result.configured, account: result.account ? profileSchema.parse(result.account) : null };
  }
  async signIn() {
    if (!isIOS()) throw new Error('Google backup is available in the iPhone app. You can export a backup from this browser.');
    return profileSchema.parse((await Native.googleSignIn()).account);
  }
  async authorizeDrive() { await Native.googleAuthorizeDrive(); }
  async token(subject: string) {
    const result = await Native.googleToken();
    if (result.subject !== subject) throw new Error('The Google account changed. Sign in again before backing up.');
    return result.accessToken;
  }
  async signOut() { if (isIOS()) await Native.googleSignOut(); }
}
