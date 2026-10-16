import { expect, test, type Page } from '@playwright/test';
import recognized from './fixtures/recognize-ok.json';

const NAMES = ['Ann', 'Ben', 'Cat', 'Dan'] as const;

// A real 16x16 JPEG, so the phone-side resize has something it can decode.
const PHOTO = Buffer.from(
  '/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAQABADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABQb/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCgAnx7/9k=',
  'base64',
);

const OK = recognized;

const TILE = {
  s7: '7 Bamboo 七索',
  s8: '8 Bamboo 八索',
  z1: 'East Wind 東風',
} as const;

async function scores(page: Page): Promise<number[]> {
  const out: number[] = [];
  for (const name of NAMES) {
    const text = await page.getByText(new RegExp(`^${name} score: -?\\d+$`)).innerText();
    out.push(Number(text.split(': ')[1]));
  }
  return out;
}

async function startGame(page: Page): Promise<void> {
  await page.goto('/setup');
  for (let i = 0; i < 4; i++) await page.locator(`#player-${i}`).fill(NAMES[i]!);
  await page.getByRole('button', { name: 'Next: rules' }).click();
  await page.getByRole('button', { name: 'Next: first dealer' }).click();
  await page.getByRole('button', { name: 'Ann', exact: true }).click();
  await page.waitForURL(/\/game\/[^/]+$/);
}

/** Ann wins by self-draw, which lands on the camera step. */
async function openCameraStep(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Hand over' }).click();
  await page.getByRole('button', { name: 'Ann', exact: true }).click();
  await page.getByRole('button', { name: 'Self-drawn' }).click();
  await expect(page.getByRole('button', { name: 'Take photo' })).toBeVisible();
}

const sendPhoto = (page: Page) =>
  page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'hand.jpg', mimeType: 'image/jpeg', buffer: PHOTO });

test.describe('phase 3: camera', () => {
  // The PWA service worker would answer /api/recognize itself on WebKit, bypassing page.route,
  // so the mocked route never sees the request. These tests drive the page, not the worker.
  test.use({ serviceWorkers: 'block' });

  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test('a photo pre-fills the hand, an uncertain tile is corrected, and the win is recorded', async ({
    page,
  }) => {
    let calls = 0;
    await page.route('**/api/recognize', async (route) => {
      calls += 1;
      expect(route.request().method()).toBe('POST');
      expect(route.request().headers()['content-type']).toBe('image/jpeg');
      await route.fulfill({ json: OK });
    });
    const start = await scores(page);

    await openCameraStep(page);
    await sendPhoto(page);

    const hand = page.getByRole('region', { name: 'Hand', exact: true });
    await expect(page.getByRole('img', { name: /photo of your hand/i })).toBeVisible();
    await expect(hand.locator('[data-state="uncertain"]')).toHaveCount(1);
    expect(calls).toBe(1);

    // The model never picks the winning tile, and this reading is not a winning hand yet.
    const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
    await expect(confirm).toBeDisabled();

    // The photo shows the outlined tile is really a 7 Bamboo: swap it.
    await hand.getByRole('button', { name: 'Remove', exact: true }).click();
    await hand.getByRole('button', { name: `Remove ${TILE.s8} (hard to read)` }).click();
    await hand.getByRole('button', { name: TILE.s7, exact: true }).click();
    await expect(hand.locator('[data-state="uncertain"]')).toHaveCount(0);

    await hand.getByRole('button', { name: 'Mark winning', exact: true }).click();
    await hand
      .getByRole('button', { name: `Mark ${TILE.z1} as winning tile` })
      .first()
      .click();
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await page.waitForURL(/\/game\/[^/]+$/);
    await expect(page.getByRole('button', { name: 'Hand over' })).toBeVisible();
    const after = await scores(page);
    expect(after[0]).toBeGreaterThan(start[0]!);
    expect(after.reduce((a, b) => a + b, 0)).toBe(start.reduce((a, b) => a + b, 0));
  });

  test('a photo with no hand explains itself and stays on the camera step', async ({ page }) => {
    await page.route('**/api/recognize', (route) =>
      route.fulfill({
        json: {
          ok: true,
          result: {
            isMahjongHand: false,
            concealed: [],
            melds: [],
            bonus: [],
            uncertain: [],
            warnings: [],
          },
        },
      }),
    );
    await openCameraStep(page);
    await sendPhoto(page);

    await expect(page.getByText(/couldn.t see a mahjong hand/i)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Hand', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('a recognition failure falls back to the manual picker beside the photo', async ({
    page,
  }) => {
    await page.route('**/api/recognize', (route) =>
      route.fulfill({ status: 502, json: { ok: false, error: 'upstream' } }),
    );
    await openCameraStep(page);
    await sendPhoto(page);

    await expect(page.getByText(/could not read that photo/i)).toBeVisible();
    await expect(page.getByRole('img', { name: /photo of your hand/i })).toBeVisible();
    const hand = page.getByRole('region', { name: 'Hand', exact: true });
    await expect(hand.getByRole('button', { name: /as winning tile$/ })).toHaveCount(0);
    // The picker is there and usable.
    await expect(hand.getByRole('button', { name: TILE.s7, exact: true })).toBeVisible();
  });

  test('the camera can always be skipped', async ({ page }) => {
    await page.route('**/api/recognize', (route) => route.abort());
    await openCameraStep(page);
    await page.getByRole('button', { name: 'Skip, enter manually' }).click();
    await expect(page.getByRole('region', { name: 'Hand', exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: /photo of your hand/i })).toHaveCount(0);
  });
});
