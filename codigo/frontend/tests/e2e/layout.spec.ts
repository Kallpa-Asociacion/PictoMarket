import { expect, test } from '@playwright/test';

// The big guide must not hide the shopping list or stretch the page.
for (const [width, height] of [
  [1366, 657],
  [1280, 800],
  [1920, 945],
  [1024, 768],
] as const)
  test(`Inti deja ver "Mi lista" y no agrega scroll a ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript(() =>
      localStorage.setItem('pictomarket.intro.seen', '1'),
    );
    await page.goto('/');
    await page.getByRole('button', { name: 'EMPEZAR' }).click();
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, 0));
    const list = (await page.locator('.list-panel').boundingBox())!;
    for (const part of ['.guide-mascot .speech-bubble', '.inti-figure']) {
      const box = (await page.locator(part).boundingBox())!;
      // The sides of the drawing canvas are empty: compare what is drawn.
      const inset = part === '.inti-figure' ? box.width * 0.12 : 0;
      const covers =
        box.x + inset < list.x + list.width &&
        box.x + box.width - inset > list.x &&
        box.y < list.y + list.height - 4 &&
        box.y + box.height > list.y;
      expect(covers, `${part} tapa la lista`).toBe(false);
    }
    // Still big enough to be seen comfortably.
    const figure = (await page.locator('.inti-figure').boundingBox())!;
    expect(figure.height).toBeGreaterThanOrEqual(180);
    // Nothing is added under the page just to make room for him.
    expect(
      await page
        .locator('.market-app')
        .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom)),
    ).toBeLessThanOrEqual(16);
  });
