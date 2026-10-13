import { expect, test, type Page } from '@playwright/test';

const NAMES = ['Ann', 'Ben', 'Cat', 'Dan'] as const;

// Tile display names as the picker labels them ("<English> <Chinese>").
const TILE = {
  s5: '5 Bamboo 五索',
  p8: '8 Dot 八筒',
  m9: '9 Character 九萬',
  m2: '2 Character 二萬',
  z7: 'Red Dragon 紅中',
  f2: 'Orchid 蘭',
} as const;

async function scores(page: Page): Promise<number[]> {
  const out: number[] = [];
  for (const name of NAMES) {
    out.push(Number(await page.getByLabel(`${name} score`).innerText()));
  }
  return out;
}

/** Taps a tile in the hand editor's "Add a tile" picker (hand tiles carry a different label). */
async function addTile(page: Page, name: string, times = 1): Promise<void> {
  const hand = page.getByRole('region', { name: 'Hand', exact: true });
  for (let i = 0; i < times; i++) {
    await hand.getByRole('button', { name, exact: true }).click();
  }
}

/** Declares a pung through the meld editor: choose the kind, then tap the tile. */
async function addPung(page: Page, name: string): Promise<void> {
  const melds = page.getByRole('region', { name: 'Melds', exact: true });
  await melds.getByRole('button', { name: /^Add Pung/ }).click();
  await melds.getByRole('button', { name, exact: true }).click();
}

async function openHandAs(page: Page, winner: string, discarder?: string): Promise<void> {
  await page.getByRole('button', { name: 'Hand over' }).click();
  await page.getByRole('button', { name: winner, exact: true }).click();
  if (discarder === undefined) {
    await page.getByRole('button', { name: 'Self-drawn' }).click();
  } else {
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    await page.getByRole('button', { name: discarder, exact: true }).click();
  }
  // The camera step comes first; this suite enters tiles by hand.
  await page.getByRole('button', { name: 'Skip, enter manually' }).click();
}

test('phase 2: tile-entry scoring, below-minimum guard and undo', async ({ page }) => {
  // Setup: four names, default rules (hk-discarder-pays, 3 fan minimum), Ann as first dealer.
  await page.goto('/setup');
  for (let i = 0; i < 4; i++) await page.locator(`#player-${i}`).fill(NAMES[i]!);
  await page.getByRole('button', { name: 'Next: rules' }).click();
  await page.getByRole('button', { name: 'Next: first dealer' }).click();
  await page.getByRole('button', { name: 'Ann', exact: true }).click();
  await page.waitForURL(/\/game\/[^/]+$/);
  const start = await scores(page);

  // Ann (east dealer, east round) wins by self-draw.
  await openHandAs(page, 'Ann');

  // Golden hand "all pungs with red dragon pung, self-drawn": 5 fan, 36 / -12 / -12 / -12.
  const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
  await expect(confirm).toBeDisabled();

  // Part-way through the hand there is a reason and Confirm stays disabled.
  const breakdown = page.getByRole('region', { name: 'Fan breakdown' });
  await addTile(page, TILE.s5, 3);
  await addTile(page, TILE.p8, 3);
  await addTile(page, TILE.m9, 2);
  await addPung(page, TILE.m2);
  await page
    .getByRole('button', { name: `Mark ${TILE.m9} as winning tile` })
    .first()
    .click();
  await expect(breakdown.getByRole('alert')).toHaveText(
    'The hand does not have the right number of tiles.',
  );
  await expect(confirm).toBeDisabled();

  // Complete the golden hand: second pung (red dragon) and the orchid, which scores nothing
  // for an east seat but removes the no-flowers fan.
  await addPung(page, TILE.z7);
  await page.getByRole('button', { name: TILE.f2, exact: true }).first().click();

  const lines = breakdown.getByRole('listitem').filter({ hasText: /fan$/ });
  await expect(breakdown.getByRole('alert')).toHaveCount(0);
  await expect(breakdown).toContainText('Self-drawn');
  await expect(breakdown).toContainText('Dragon');
  await expect(breakdown).toContainText('All pungs');
  await expect(breakdown).toContainText('Total 5 fan');
  expect(await lines.count()).toBe(3);

  const payments = page.getByRole('list', { name: 'Payments' });
  const rows = payments.getByRole('listitem');
  const expected = ['+36', '-12', '-12', '-12'];
  for (let i = 0; i < 4; i++) {
    await expect(rows.nth(i)).toContainText(`${NAMES[i]}`);
    await expect(rows.nth(i)).toContainText(expected[i]!);
  }

  await expect(confirm).toBeEnabled();
  await confirm.click();
  await page.waitForURL(/\/game\/[^/]+$/);
  await expect(page.getByRole('button', { name: 'Hand over' })).toBeVisible();

  const afterWin = await scores(page);
  expect(afterWin.map((s, i) => s - start[i]!)).toEqual([36, -12, -12, -12]);

  // Undo the hand from history: scores return to the starting values.
  await page.getByRole('button', { name: 'History' }).click();
  const row = page.getByRole('listitem').filter({ hasText: '5 fan' });
  await row.getByRole('button', { name: 'Undo', exact: true }).click();
  await row.getByRole('button', { name: 'Confirm undo', exact: true }).click();
  await expect(page.getByText(/won 5 fan/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to table' }).click();
  expect(await scores(page)).toEqual(start);
});

test('phase 2: a hand below the minimum fan cannot be confirmed', async ({ page }) => {
  await page.goto('/setup');
  for (let i = 0; i < 4; i++) await page.locator(`#player-${i}`).fill(NAMES[i]!);
  await page.getByRole('button', { name: 'Next: rules' }).click();
  await page.getByRole('button', { name: 'Next: first dealer' }).click();
  await page.getByRole('button', { name: 'Ann', exact: true }).click();
  await page.waitForURL(/\/game\/[^/]+$/);
  const start = await scores(page);

  // Ben wins off Cat with a plain hand: four chows, a pair, one exposed pung. No scoring
  // pattern and below the 3 fan minimum.
  await openHandAs(page, 'Ben', 'Cat');
  const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
  const chowTiles = ['4 Dot 四筒', '5 Dot 五筒', '6 Dot 六筒', '7 Bamboo 七索', '8 Bamboo 八索'];
  await addTile(page, '2 Character 二萬', 3);
  for (const t of chowTiles) await addTile(page, t);
  await addTile(page, '9 Bamboo 九索');
  await addTile(page, '3 Character 三萬');
  await addTile(page, '4 Character 四萬');
  await addTile(page, '5 Character 五萬');
  await addTile(page, '9 Dot 九筒', 2);
  await page.getByRole('button', { name: 'Mark 9 Dot 九筒 as winning tile' }).first().click();

  const alert = page.getByRole('region', { name: 'Fan breakdown' }).getByRole('alert');
  await expect(alert).toHaveText('The hand is below the minimum fan required to win.');
  await expect(confirm).toBeDisabled();
  await expect(page.getByRole('list', { name: 'Payments' })).toHaveCount(0);

  // Cancelling appends nothing.
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.waitForURL(/\/game\/[^/]+$/);
  expect(await scores(page)).toEqual(start);
});
