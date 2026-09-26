import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';

async function setup(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
}

test.beforeEach(async ({ context }) => {
  // A Wednesday morning
  await context.clock.install({ time: new Date('2026-09-23T08:00:00+02:00') });
});

test('clock in, take a break, clock out', async ({ page }) => {
  await setup(page);
  await expect(page.getByTestId('status')).toHaveText('Not clocked in');
  await page.getByRole('button', { name: 'Clock in' }).click();
  await expect(page.getByTestId('status')).toHaveText('Working');

  await page.clock.fastForward('04:00:00');
  await page.getByRole('button', { name: 'Break', exact: true }).click();
  await expect(page.getByTestId('status')).toHaveText('On break');

  await page.clock.fastForward('00:30:00');
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.clock.fastForward('04:00:00');
  await page.getByRole('button', { name: 'Clock out' }).click();
  await expect(page.getByTestId('status')).toHaveText('Not clocked in');
  await expect(page.getByTestId('timer')).toHaveText('8:00');
  await expect(page.getByText('08:00 – 12:00')).toBeVisible();
});

test('undo a stamp', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Clock in' }).click();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('status')).toHaveText('Not clocked in');
});

test('timed break ends by itself', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Clock in' }).click();
  await page.clock.fastForward('01:00:00');
  await page.getByRole('button', { name: '15 min' }).click();
  await expect(page.getByText('Break ends at 09:15')).toBeVisible();
  await page.clock.fastForward('00:16:00');
  await expect(page.getByTestId('status')).toHaveText('Working');
});

test('add and edit an entry by hand', async ({ page }) => {
  await setup(page);
  await page.goto('/calendar');
  await page.locator('[data-date="2026-09-22"]').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'New entry' });
  await sheet.getByLabel('From').fill('09:00');
  await sheet.getByLabel('To').fill('17:30');
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('dialog').getByText('09:00 – 17:30')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-date="2026-09-22"]')).toContainText('8:30');
});

test('mark several days as vacation', async ({ page }) => {
  await setup(page);
  await page.goto('/calendar?view=month&d=2026-10-01');
  await page.getByRole('button', { name: 'Select' }).click();
  for (const d of ['2026-10-05', '2026-10-06', '2026-10-07']) await page.locator(`[data-date="${d}"]`).click();
  await page.getByRole('button', { name: 'Mark 3 days' }).click();
  await expect(page.getByText('Uses 3 vacation days · 27 left afterwards')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved for 3 day(s)')).toBeVisible();
  await page.goto('/settings/vacation');
  await expect(page.getByText('Planned').locator('..')).toContainText('3');
});

test('export PDF and CSV', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Clock in' }).click();
  await page.clock.fastForward('02:00:00');
  await page.getByRole('button', { name: 'Clock out' }).click();
  await expect(page.getByText('Clocked out at 10:00')).toBeVisible();
  await page.goto('/stats');
  const [pdf] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'PDF timesheet' }).click()
  ]);
  expect(pdf.suggestedFilename()).toBe('punchclock-2026-09.pdf');
  const pdfBytes = fs.readFileSync((await pdf.path())!);
  expect(pdfBytes.subarray(0, 4).toString()).toBe('%PDF');
  const [csv] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'CSV by day' }).click()
  ]);
  const text = fs.readFileSync((await csv.path())!, 'utf8');
  expect(text).toContain('2026-09-23,Wednesday,08:00,10:00');
});

test('backup and restore move all data', async ({ page, browser }) => {
  await setup(page);
  await page.getByRole('button', { name: 'Clock in' }).click();
  await page.clock.fastForward('03:00:00');
  await page.getByRole('button', { name: 'Clock out' }).click();
  await expect(page.getByText('Clocked out at 11:00')).toBeVisible();
  await page.goto('/settings/data');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Create backup/ }).click()
  ]);
  const file = (await download.path())!;

  // A fresh device
  const other = await browser.newContext({
    locale: 'en-US',
    timezoneId: 'Europe/Berlin',
    viewport: { width: 400, height: 860 }
  });
  await other.clock.install({ time: new Date('2026-09-23T12:00:00+02:00') });
  const page2 = await other.newPage();
  await page2.goto('/');
  const [chooser] = await Promise.all([
    page2.waitForEvent('filechooser'),
    page2.getByRole('button', { name: 'Restore from backup' }).click()
  ]);
  await chooser.setFiles(file);
  await expect(page2.getByRole('heading', { name: 'Today' })).toBeVisible();
  await expect(page2.getByTestId('timer')).toHaveText('3:00');
  await other.close();
});

test('switch language to German', async ({ page }) => {
  await setup(page);
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Deutsch' }).click();
  await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();
});

test('desktop uses the sidebar and its mini clock', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setup(page);
  await page.getByRole('link', { name: 'Calendar' }).click();
  const sidebar = page.locator('aside');
  await expect(sidebar).toBeVisible();
  await sidebar.getByRole('button', { name: 'Clock in' }).click();
  await expect(sidebar.getByText('Working')).toBeVisible();
  await expect(page.locator('[data-date="2026-09-23"]').first()).toBeVisible();
});

test('manual entry with a break duration and target time', async ({ page }) => {
  await setup(page);
  await page.goto('/calendar?view=week&d=2026-09-21');
  await page.locator('[data-date="2026-09-21"]').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'New entry' });
  await sheet.getByLabel('From').fill('08:00');
  await sheet.getByRole('button', { name: 'Target time (8:00)' }).click();
  await expect(sheet.getByLabel('To')).toHaveValue('16:30');
  await expect(sheet.getByText('Duration: 8:00')).toBeVisible();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('dialog').getByText('30 min break')).toBeVisible();
});

test('fill past days with their target time', async ({ page }) => {
  await setup(page);
  await page.goto('/calendar?view=week&d=2026-09-14');
  await page.getByRole('button', { name: 'Select' }).click();
  for (const d of ['2026-09-14', '2026-09-15', '2026-09-19']) await page.locator(`[data-date="${d}"]`).click();
  // Saturday has no target, so only two days get filled
  await page.getByRole('button', { name: 'Target time (2)' }).click();
  await expect(page.getByText('Target time added for 2 day(s)')).toBeVisible();
  await expect(page.locator('[data-date="2026-09-14"]')).toContainText('8:00');
  await expect(page.locator('[data-date="2026-09-14"]')).toContainText('+0:00');
});

test('typing an absence label keeps the text', async ({ page }) => {
  await setup(page);
  await page.goto('/calendar?view=week&d=2026-09-28');
  await page.locator('[data-date="2026-09-28"]').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Mark' }).click();
  const label = page.getByPlaceholder('e.g. Summer trip');
  await label.pressSequentially('Summer', { delay: 50 });
  await page.clock.fastForward('00:00:03');
  await label.pressSequentially(' trip', { delay: 50 });
  await expect(label).toHaveValue('Summer trip');
});

async function swipeLeft(page: Page, selector: string) {
  await page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      const y = r.top + 40;
      const touch = (x: number) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
      el.dispatchEvent(
        new TouchEvent('touchstart', { touches: [touch(300)], changedTouches: [touch(300)], bubbles: true })
      );
      el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [touch(120)], bubbles: true }));
    });
}

test('swiping changes the period in calendar and stats', async ({ page }) => {
  await setup(page);
  await page.goto('/calendar?view=month&d=2026-09-01');
  await expect(page.getByText('September 2026')).toBeVisible();
  await swipeLeft(page, '[data-date="2026-09-10"]');
  await expect(page.getByText('October 2026')).toBeVisible();

  await page.goto('/stats?view=month&d=2026-09-01');
  await expect(page.getByText('September 2026')).toBeVisible();
  await swipeLeft(page, 'main section');
  await expect(page.getByText('October 2026')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByText('September 2026')).toBeVisible();
});

test('long press on a day starts selection', async ({ page }) => {
  await setup(page);
  await page.goto('/calendar?view=month&d=2026-10-01');
  const day = page.locator('[data-date="2026-10-12"]');
  await day.hover();
  await page.mouse.down();
  await page.clock.runFor(700);
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('[data-date="2026-10-13"]').click();
  await expect(page.getByRole('button', { name: 'Mark 2 days' })).toBeVisible();
});
