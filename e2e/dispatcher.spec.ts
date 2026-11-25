import { expect, test } from '@playwright/test';

test('dispatcher sees the board and reassigns an open job', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('welcome-try-demo').click();
  await page.getByTestId('persona-jordan').click();
  await expect(page.getByText('Priya Shah')).toBeVisible();
  await expect(page.getByText('Mueller Branch Library')).toBeVisible();
  await page.getByTestId('job-card-job_harbor_mueller').click();
  await page.getByTestId('reassign-member_casey_harbor').click();
  await expect(page.getByText('Assigned to Casey Nguyen')).toBeVisible();
});

test('magic link signs in a known demo inbox and rejects an unknown one', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('welcome-sign-in').click();
  await page.getByTestId('sign-in-email').fill('alex.rivera@harborpine.demo');
  await page.getByTestId('sign-in-submit').click();
  await page.getByTestId('open-magic-link').click();
  await expect(page.getByText('Lila Nguyen')).toBeVisible();
  await page.getByTestId('tab-account').click();
  await page.getByTestId('sign-out').click();
  await page.getByTestId('welcome-sign-in').click();
  await page.getByTestId('sign-in-email').fill('nobody@example.com');
  await page.getByTestId('sign-in-submit').click();
  await page.getByTestId('open-magic-link').click();
  await expect(page.getByTestId('auth-error')).toContainText('No Jobflow workspace');
});

test('switching organizations changes Alex from technician to dispatcher', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('welcome-try-demo').click();
  await page.getByTestId('persona-alex').click();
  await expect(page.getByText('Lila Nguyen')).toBeVisible();
  await page.getByTestId('tab-account').click();
  await page.getByTestId('org-org_summit').click();
  await expect(page.getByTestId('board-screen').getByText('Summit Mechanical')).toBeVisible();
  await expect(page.getByTestId('board-screen').getByText('Mina Alvarez')).toBeVisible();
});
