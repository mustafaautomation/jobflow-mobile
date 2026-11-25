import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const base = process.env.PREVIEW_URL ?? 'http://127.0.0.1:44517';
const out = new URL('../docs/screenshots/', import.meta.url);

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

async function shot(name) {
  await page.screenshot({ path: new URL(`${name}.png`, out).pathname, fullPage: false });
}

await page.goto(base);
await page.getByTestId('welcome-try-demo').waitFor();
await shot('welcome');

await page.getByTestId('welcome-try-demo').click();
await page.getByTestId('persona-alex').click();
await page.getByText('Lila Nguyen').waitFor();
await shot('today');

await page.getByTestId('job-card-job_harbor_lila').click();
await page.getByTestId('job-start').waitFor();
await shot('job');

await page.getByTestId('job-back').click();
await page.getByTestId('tab-account').click();
await page.getByTestId('theme-dark').click();
await page.getByText('Appearance').waitFor();
await shot('account-dark');

await page.getByTestId('org-org_summit').click();
await page.getByTestId('board-screen').getByText('Mina Alvarez').waitFor();
await shot('dispatch-board');

await browser.close();
console.log('saved screenshots');
