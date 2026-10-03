import { expect, test, type Page } from '@playwright/test';

const NAMES = ['Ann', 'Ben', 'Cat', 'Dan'] as const;

/** Reads the four scores from the table view, in seat order. */
async function scores(page: Page): Promise<number[]> {
  const out: number[] = [];
  for (const name of NAMES) {
    out.push(Number(await page.getByLabel(`${name} score`).innerText()));
  }
  return out;
}

/** Asserts the dealer marker, the prevailing wind and the dealer-repeat counter on the table. */
async function expectTable(
  page: Page,
  expected: { dealer: number; round: 'East' | 'South'; repeat: number },
): Promise<void> {
  await expect(page.getByText(`${expected.round} round`)).toBeVisible();
  await expect(page.getByText(`dealer repeat ${expected.repeat}`)).toBeVisible();
  for (let seat = 0; seat < 4; seat++) {
    await expect(page.getByTestId(`seat-card-${seat}`)).toHaveAttribute(
      'data-dealer',
      String(seat === expected.dealer),
    );
  }
}

async function recordWin(
  page: Page,
  winner: string,
  fan: number,
  discarder?: string,
): Promise<void> {
  await page.getByRole('button', { name: 'Hand over' }).click();
  await page.getByRole('button', { name: winner, exact: true }).click();
  if (discarder === undefined) {
    await page.getByRole('button', { name: 'Self-drawn' }).click();
  } else {
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await page.getByRole('button', { name: discarder, exact: true }).click();
  }
  for (let i = 0; i < fan; i++) await page.getByRole('button', { name: 'Increase fan' }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Hand over' })).toBeVisible();
}

async function recordDraw(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Hand over' }).click();
  await page.getByRole('button', { name: 'Draw', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm draw' }).click();
  await expect(page.getByRole('button', { name: 'Hand over' })).toBeVisible();
}

test('phase 1: full manual game with undo, override, reload and offline', async ({
  page,
  context,
  browserName,
}) => {
  // Setup: four names, default rules, Ann as first dealer.
  await page.goto('/setup');
  for (let i = 0; i < 4; i++) await page.locator(`#player-${i}`).fill(NAMES[i]!);
  await page.getByRole('button', { name: 'Next: rules' }).click();
  await page.getByRole('button', { name: 'Next: first dealer' }).click();
  await page.getByRole('button', { name: 'Ann', exact: true }).click();
  await page.waitForURL(/\/game\/[^/]+$/);
  await expectTable(page, { dealer: 0, round: 'East', repeat: 0 });
  const start = await scores(page);
  const total = start.reduce((a, b) => a + b, 0);

  // Dealer win: Ann stays dealer, repeat 1.
  await recordWin(page, 'Ann', 3);
  await expectTable(page, { dealer: 0, round: 'East', repeat: 1 });
  const afterDealerWin = await scores(page);
  expect(afterDealerWin[0]).toBeGreaterThan(start[0]!);

  // Non-dealer win: Ben wins off Cat, the deal passes to Ben.
  await recordWin(page, 'Ben', 3, 'Cat');
  await expectTable(page, { dealer: 1, round: 'East', repeat: 0 });
  const afterBenWin = await scores(page);
  expect(afterBenWin[1]).toBeGreaterThan(afterDealerWin[1]!);
  expect(afterBenWin[2]).toBeLessThan(afterDealerWin[2]!);

  // Draw: the dealer stays and the repeat counter increments, scores unchanged.
  await recordDraw(page);
  await expectTable(page, { dealer: 1, round: 'East', repeat: 1 });
  expect(await scores(page)).toEqual(afterBenWin);

  // Undo the draw from history.
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByText('Draw (流局)')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).last().click();
  await page
    .getByRole('button', { name: /confirm|undo/i })
    .last()
    .click();
  await expect(page.getByText('Draw (流局)')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to table' }).click();
  await expectTable(page, { dealer: 1, round: 'East', repeat: 0 });

  // Reload mid-game: state survives.
  await page.reload();
  await expectTable(page, { dealer: 1, round: 'East', repeat: 0 });
  expect(await scores(page)).toEqual(afterBenWin);

  // Manual override: make Dan the dealer, repeat 0.
  await page.getByRole('button', { name: 'Override' }).click();
  const sheet = page.getByRole('region', { name: 'Override table state' });
  await sheet.getByRole('combobox').first().selectOption({ label: 'Dan' });
  await sheet.getByRole('spinbutton').fill('0');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expectTable(page, { dealer: 3, round: 'East', repeat: 0 });

  // Offline: a non-dealer win passes the deal back to Ann, who started it, so the wind advances.
  // Playwright's WebKit does not route offline navigations through the service worker, so the
  // offline leg is exercised on Chromium only; WebKit still records the same hand online.
  const offline = browserName === 'chromium';
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (offline) await context.setOffline(true);
  await recordWin(page, 'Ann', 3, 'Dan');
  await expectTable(page, { dealer: 0, round: 'South', repeat: 0 });
  const finalScores = await scores(page);
  expect(finalScores.reduce((a, b) => a + b, 0)).toBe(total);

  // And it persisted locally, still offline.
  await page.reload();
  await expectTable(page, { dealer: 0, round: 'South', repeat: 0 });
  expect(await scores(page)).toEqual(finalScores);
  if (offline) await context.setOffline(false);
});
