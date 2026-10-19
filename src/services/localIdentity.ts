import type { Account } from '../storage/schema';
export interface Identity { status(): Promise<{ configured: boolean; account: Account | null }> }
export class LocalIdentity implements Identity {
  constructor(private profile: () => Account) {}
  async status() { return { configured: true, account: this.profile() }; }
}
