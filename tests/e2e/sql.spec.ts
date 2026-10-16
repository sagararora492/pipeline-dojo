import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test, type Page } from '@playwright/test';

async function replaceAnswer(page: Page, sql: string) {
  const editor = page.getByRole('textbox', { name: /SQL answer for/ });
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(sql);
}

test.beforeEach(async ({ page }) => {
  // Everything must be served by the site itself: fail on any outside request.
  await page.route(/^(?!http:\/\/localhost)/, (route) => route.abort());
});

test('solves the sample SQL exercise offline, end to end', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: /^SQL/ }).first().click();
  await page.getByRole('link', { name: /Keep the latest row per key/ }).click();

  const check = page.getByRole('button', { name: 'Check answer' });
  await expect(check).toBeEnabled({ timeout: 30_000 });

  await check.click();
  await expect(page.getByText('Not quite')).toBeVisible();

  await replaceAnswer(
    page,
    `SELECT * FROM order_changes
     QUALIFY row_number() OVER (PARTITION BY order_id ORDER BY updated_at DESC) = 1`,
  );
  await check.click();
  await expect(page.getByText('Correct. Your result matches the reference.')).toBeVisible();
  await expect(page.getByText('✓ Solved')).toBeVisible();

  // Progress survives a reload.
  await page.reload();
  await expect(page.getByText('✓ Solved')).toBeVisible();
});

test('learner SQL cannot reach other origins', async ({ page }) => {
  // Another origin on localhost, so the route guard above lets it through and
  // only the site's Content Security Policy can stop DuckDB from reaching it.
  let hits = 0;
  const server = createServer((_request, response) => {
    hits += 1;
    response.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain' });
    response.end('reachable');
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;

  try {
    await page.goto('./#/sql/latest-row-per-key');
    const run = page.getByRole('button', { name: 'Run' });
    await expect(run).toBeEnabled({ timeout: 30_000 });

    await replaceAnswer(page, `SELECT content FROM read_text('http://localhost:${port}/data.txt')`);
    await run.click();

    await expect(page.locator('.feedback-error')).toBeVisible();
    await expect(page.getByText('reachable', { exact: true })).toHaveCount(0);
    expect(hits).toBe(0);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
