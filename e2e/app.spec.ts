import { test, expect, type Page } from '@playwright/test';
const PASSWORD = 'My local password 123';
async function unlock(page: Page) { await page.getByLabel('Password', { exact: true }).fill(PASSWORD); await page.getByRole('button', { name: 'Unlock', exact: true }).click(); await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible(); }
const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = []; browserErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
});
test.afterEach(({ page }) => { expect(browserErrors.get(page)).toEqual([]); });
async function openApp(page: Page) {
  await page.goto('/');
  await page.getByLabel('Your name', { exact: true }).fill('Ashraf');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create local profile', exact: true }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your day, anchored to prayer', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
}
async function openBackups(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByText('Profile & Backups', { exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Profile & Backups' })).toBeVisible();
}
test('offline data survives reload and portable backup export/import', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await openApp(page);
  if (process.env.ANCHOROS_QA_DIR) await page.screenshot({ path: `${process.env.ANCHOROS_QA_DIR}/today.png` });
  await openBackups(page);
  if (process.env.ANCHOROS_QA_DIR) {
    await expect.poll(() => page.getByRole('dialog', { name: 'Profile & Backups' }).locator(':scope > div').evaluate(el => Math.abs(el.getBoundingClientRect().top - innerHeight * 0.06))).toBeLessThan(1);
    await page.screenshot({ path: `${process.env.ANCHOROS_QA_DIR}/account-backup.png` });
  }
  const downloaded = page.waitForEvent('download'); await page.getByText('Export encrypted backup', { exact: true }).click();
  const file = await downloaded; expect(file.suggestedFilename()).toContain('AnchorOS-backup');
  const path = await file.path(); expect(path).toBeTruthy();
  await page.getByLabel('Import a backup', { exact: true }).setInputFiles(path!);
  await expect(page.getByText('Review before restoring', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await page.reload(); await unlock(page); await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('rejects a damaged import without replacing the current dataset', async ({ page }) => {
  await openApp(page); await openBackups(page);
  await page.getByLabel('Import a backup', { exact: true }).setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{invalid') });
  await expect(page.getByRole('alert')).toContainText('not valid JSON');
  await expect(page.getByText('Review before restoring', { exact: true })).toHaveCount(0);
});
test('a second tab cannot overwrite the active device dataset', async ({ page, context }) => {
  await openApp(page); const second = await context.newPage(); await second.goto('/');
  await expect(second.getByRole('alert')).toContainText('another window');
  await page.close(); await second.getByRole('button', { name: 'Try again', exact: true }).click(); await unlock(second);
  await expect(second.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
});

test('nested settings close one sheet at a time and all tabs open', async ({ page }) => {
  await openApp(page); await openBackups(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Profile & Backups' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Settings', exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  for (const tab of ['Deen', 'Focus', 'Wallet', 'Today']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await expect(page.getByRole('main')).toBeVisible();
  }
});

test('parks a thought offline, converts it to a routine, and persists it', async ({ page, context }) => {
  await openApp(page); await page.getByRole('tab', { name: /^Inbox/ }).click();
  await context.setOffline(true);
  await page.getByRole('textbox', { name: 'New thought' }).fill('Prepare my network lab');
  await page.getByRole('button', { name: 'Park it', exact: true }).click();
  await expect(page.getByText('Prepare my network lab', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Make task after / }).click();
  await expect(page.getByText('Mind clear', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Routine', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Complete Prepare my network lab', exact: true })).toHaveCount(1);
  await expect(page.getByRole('checkbox', { name: 'Complete Prepare my network lab', exact: true })).toBeVisible();
  await context.setOffline(false); await page.reload(); await unlock(page);
  await page.getByRole('tab', { name: 'Routine', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Complete Prepare my network lab', exact: true })).toHaveCount(1);
  await expect(page.getByRole('checkbox', { name: 'Complete Prepare my network lab', exact: true })).toBeVisible();
});

test('adds and deletes a real expense across reloads', async ({ page }) => {
  await openApp(page); await page.getByRole('button', { name: 'Wallet', exact: true }).click();
  await page.getByLabel('Log expense', { exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Log Expense', exact: true });
  await sheet.getByLabel('Amount', { exact: true }).fill('25.50');
  await sheet.getByPlaceholder('What was it?').fill('Campus lunch');
  await sheet.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(sheet).toHaveCount(0); await expect(page.getByText('Campus lunch', { exact: true })).toBeVisible();
  await page.reload(); await unlock(page); await page.getByRole('button', { name: 'Wallet', exact: true }).click();
  await expect(page.getByText('Campus lunch', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete Campus lunch', exact: true }).click();
  await expect(page.getByText('Campus lunch', { exact: true })).toHaveCount(0);
});

test('keeps a deadline without steps pending and completes its added step', async ({ page }) => {
  await openApp(page); await page.getByRole('button', { name: 'Focus', exact: true }).click();
  await page.getByRole('tab', { name: 'Uni', exact: true }).click();
  await page.getByRole('button', { name: 'Add deadline', exact: true }).first().click();
  const sheet = page.getByRole('dialog', { name: 'New Deadline', exact: true });
  await sheet.getByLabel('Course', { exact: true }).fill('Networks');
  await sheet.getByLabel('Title', { exact: true }).fill('VLAN lab');
  await sheet.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await page.getByText('Networks · VLAN lab', { exact: true }).click();
  const detail = page.getByRole('dialog', { name: 'Networks', exact: true });
  await detail.getByLabel('New step', { exact: true }).fill('Submit the topology');
  await detail.getByRole('button', { name: 'Add', exact: true }).click();
  await detail.getByRole('checkbox', { name: 'Submit the topology', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText('All steps done', { exact: true })).toBeVisible();
  await page.reload(); await unlock(page); await page.getByRole('button', { name: 'Focus', exact: true }).click();
  await page.getByRole('tab', { name: 'Uni', exact: true }).click();
  await expect(page.getByText('All steps done', { exact: true })).toBeVisible();
});

test('preserves a paused focus timer through a reload', async ({ page }) => {
  await openApp(page); await page.getByRole('button', { name: 'Focus', exact: true }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByText('Paused', { exact: true })).toBeVisible();
  await page.reload(); await unlock(page); await page.getByRole('button', { name: 'Focus', exact: true }).click();
  await expect(page.getByText('Paused', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop and save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop and save', exact: true })).toBeDisabled();
});

test('locks the profile and rejects an incorrect password without losing activities', async ({ page }) => {
  await openApp(page); await page.getByRole('tab', { name: /^Inbox/ }).click();
  await page.getByLabel('New thought', { exact: true }).fill('Private activity'); await page.getByRole('button', { name: 'Park it', exact: true }).click();
  await openBackups(page); await page.getByRole('button', { name: 'Lock app', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back, Ashraf', exact: true })).toBeVisible();
  await expect(page.getByText('Private activity', { exact: true })).toHaveCount(0);
  await page.getByLabel('Password', { exact: true }).fill('wrong password'); await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('incorrect'); await unlock(page);
  await page.getByRole('tab', { name: /^Inbox/ }).click(); await expect(page.getByText('Private activity', { exact: true })).toBeVisible();
});

test('restores the same name, password, and activities in a completely fresh installation', async ({ page, browser }) => {
  await openApp(page); await page.getByRole('tab', { name: /^Inbox/ }).click();
  await page.getByLabel('New thought', { exact: true }).fill('Keep this after reinstalling'); await page.getByRole('button', { name: 'Park it', exact: true }).click();
  await openBackups(page); const waiting = page.waitForEvent('download'); await page.getByText('Export encrypted backup', { exact: true }).click();
  const file = await waiting; const path = await file.path(); expect(path).toBeTruthy();
  const fresh = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const second = await fresh.newPage(); await second.goto('http://127.0.0.1:4173/');
    await second.getByLabel('Encrypted backup file', { exact: true }).setInputFiles(path!);
    await second.getByLabel('Backup password', { exact: true }).fill(PASSWORD);
    await second.getByRole('button', { name: 'Review backup', exact: true }).click();
    await expect(second.getByText('Restore Ashraf’s activities?', { exact: true })).toBeVisible();
    await second.getByRole('button', { name: 'Confirm restore', exact: true }).click();
    await second.getByRole('tab', { name: /^Inbox/ }).click();
    await expect(second.getByText('Keep this after reinstalling', { exact: true })).toBeVisible();
    await second.reload(); await unlock(second);
    await second.getByRole('tab', { name: /^Inbox/ }).click();
    await expect(second.getByText('Keep this after reinstalling', { exact: true })).toBeVisible();
  } finally { await fresh.close(); }
});
