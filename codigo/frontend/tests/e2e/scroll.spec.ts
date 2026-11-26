import { expect, test, type Page } from '@playwright/test';

const TARGETS = {
  'último producto': '[data-product-id] >> nth=-1',
  'panel del terapeuta': '.therapist-button',
  'controles de voz': 'button:has-text("Activar voz") >> nth=-1',
  créditos: '.credits',
};

// Real wheel input on purpose: window.scrollTo() also works on a page whose
// scroll is locked with overflow:hidden, so it cannot detect that bug.
// Returns what never showed up completely while turning the wheel.
async function neverSeenWheelingDown(page: Page) {
  const { width, height } = page.viewportSize()!;
  const pending = new Map(Object.entries(TARGETS));
  // Over the top bar: the wheel must work wherever the pointer is.
  await page.mouse.move(width / 2, 20);
  for (let step = 0; step < 40 && pending.size; step++) {
    for (const [name, selector] of pending) {
      const box = await page.locator(selector).boundingBox();
      if (box && box.y >= -1 && box.y + box.height <= height + 1)
        pending.delete(name);
    }
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(80);
  }
  return [...pending.keys()];
}

for (const [width, height] of [
  [1898, 910],
  [1366, 657],
  [1024, 768],
  [390, 844],
])
  test(`la rueda llega a todo el juego a ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript(() =>
      localStorage.setItem('pictomarket.intro.seen', '1'),
    );
    await page.goto('/');
    await page.getByRole('button', { name: 'EMPEZAR' }).click();
    await page.waitForTimeout(800);
    expect(await neverSeenWheelingDown(page)).toEqual([]);
  });
