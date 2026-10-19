import { test, expect, type Page } from '@playwright/test';
async function openApp(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your day, anchored to prayer', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
}
async function openBackups(page: Page) {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByText('Account & Backup', { exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Account & Backup' })).toBeVisible();
}
test('offline data survives reload and portable backup export/import', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await openApp(page);
  if (process.env.ANCHOROS_QA_DIR) await page.screenshot({ path: `${process.env.ANCHOROS_QA_DIR}/today.png` });
  await openBackups(page);
  if (process.env.ANCHOROS_QA_DIR) {
    await expect.poll(() => page.getByRole('dialog', { name: 'Account & Backup' }).locator(':scope > div').evaluate(el => Math.abs(el.getBoundingClientRect().top - innerHeight * 0.06))).toBeLessThan(1);
    await page.screenshot({ path: `${process.env.ANCHOROS_QA_DIR}/account-backup.png` });
  }
  const downloaded = page.waitForEvent('download'); await page.getByText('Export a backup', { exact: true }).click();
  const file = await downloaded; expect(file.suggestedFilename()).toContain('AnchorOS-backup');
  const path = await file.path(); expect(path).toBeTruthy();
  await page.getByLabel('Import a backup', { exact: true }).setInputFiles(path!);
  await expect(page.getByText('Review before restoring', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await page.reload(); await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
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
  await page.close(); await second.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(second.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
});

test('nested settings close one sheet at a time and all tabs open', async ({ page }) => {
  await openApp(page); await openBackups(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Account & Backup' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Settings', exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  for (const tab of ['Deen', 'Focus', 'Wallet', 'Today']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await expect(page.getByRole('main')).toBeVisible();
  }
});
