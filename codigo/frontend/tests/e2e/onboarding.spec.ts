import { mkdir } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';

async function skipIntro(page: Page) {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem('pictomarket.intro.seen', '1'),
  );
  await page.reload();
}
async function startGame(page: Page) {
  await skipIntro(page);
  await page.getByRole('button', { name: 'EMPEZAR' }).click();
  await expect(page.locator('[data-product-id]')).toHaveCount(10);
}
async function waitForImages(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from(document.images).every(
          (img) => img.complete && img.naturalWidth > 0,
        ),
      ),
    )
    .toBe(true);
}
const HINT_MOOD = /^(think|encourage|point)$/;
type Box = { x: number; y: number; width: number; height: number };
const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;
async function boxes(locator: Locator): Promise<Box[]> {
  const result: Box[] = [];
  for (const item of await locator.all()) {
    const box = await item.boundingBox();
    if (box) result.push(box);
  }
  return result;
}

test('primera visita: Inti presenta sobre el juego y la segunda va directo', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('button', { name: /Cómo se juega/ })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'EMPEZAR' }).click();
  await expect(page.locator('[data-product-id]')).toHaveCount(10);
  await expect(page.locator('#tour-heading')).toHaveText('¡Hola! Soy Inti');
  for (let step = 0; step < 4; step++)
    await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.locator('#tour-heading')).toHaveText('¡A comprar!');
  await page.getByRole('button', { name: '¡A comprar!' }).click();
  await expect(page.locator('.tour')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'EMPEZAR' }).click();
  await expect(page.locator('[data-product-id]')).toHaveCount(10);
  await expect(page.locator('.tour')).toHaveCount(0);
});

test('el terapeuta puede repetir la presentación; Saltar la cierra', async ({
  page,
}) => {
  await startGame(page);
  await page.getByRole('button', { name: 'Panel del terapeuta' }).click();
  await page.getByRole('button', { name: 'Ver presentación otra vez' }).click();
  await expect(page.locator('.tour')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tour-heading')).toHaveText('Mira la lista');
  await page.getByRole('button', { name: 'Saltar' }).click();
  await expect(page.locator('.tour')).toHaveCount(0);
});

test('tocar un distractor muestra la nube con ánimo de pista', async ({
  page,
}) => {
  await startGame(page);
  await page.locator('[data-product-id="2699"]').click(); // champú
  // Which help comes first depends on the selected policy; Inti always
  // switches to a hint mood (think, encourage or point).
  await expect(page.locator('.guide-figure')).toHaveAttribute(
    'data-mood',
    HINT_MOOD,
  );
  await expect(page.locator('.guide-mascot .speech-bubble')).toBeVisible();
});

for (const [width, height] of [
  [1280, 800],
  [1024, 768],
  [768, 1024],
  [375, 812],
  [320, 700],
] as const) {
  test(`el guía no tapa productos ni controles a ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await startGame(page);
    await waitForImages(page);
    await mkdir('artifacts', { recursive: true });
    const guide = page.locator(
      '.guide-mascot .speech-bubble, .guide-mascot .guide-portrait-frame',
    );
    // Check the greeting, then the longest bubble (idle/hint) as well.
    for (const phase of ['greeting', 'hint']) {
      if (phase === 'hint') {
        await page.locator('[data-product-id="2699"]').click();
        await expect(page.locator('.guide-figure')).toHaveAttribute(
          'data-mood',
          HINT_MOOD,
        );
      }
      await page.screenshot({
        path: `artifacts/game-${width}-${phase}.png`,
        fullPage: true,
      });
      // Clicking may scroll the page; the guide is fixed, so measure at the top.
      await page.evaluate(() => window.scrollTo(0, 0));
      const guideBoxes = await boxes(guide);
      expect(guideBoxes).toHaveLength(2);
      const blocked = await boxes(
        page.locator(
          '[data-product-id], .speaker-button, .instruction-board, .shopping-sidebar, .topbar, .voice-panel',
        ),
      );
      for (const g of guideBoxes)
        for (const other of blocked) expect(intersects(g, other)).toBe(false);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

for (const [width, height] of [
  [1280, 800],
  [768, 1024],
  [375, 812],
  [320, 700],
] as const) {
  test(`Inti camina a cada elemento y oscurece el fondo a ${width}×${height}`, async ({
    page,
  }) => {
    await mkdir('artifacts', { recursive: true });
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'EMPEZAR' }).click();
    await waitForImages(page);
    const targets = [
      null,
      '.list-panel',
      '.shelf-row',
      '.instruction-board',
      '.wallet-panel',
    ];
    const seen: string[] = [];
    for (let step = 0; step < targets.length; step++) {
      await page.waitForTimeout(800); // let the walk finish
      await page.screenshot({
        path: `artifacts/tour-${width}-${step + 1}.png`,
      });
      const guide = (await page.locator('.tour-guide').boundingBox())!;
      // Inti and the dialog always stay fully on screen.
      expect(guide.x).toBeGreaterThanOrEqual(0);
      expect(guide.y).toBeGreaterThanOrEqual(0);
      expect(guide.x + guide.width).toBeLessThanOrEqual(width);
      expect(guide.y + guide.height).toBeLessThanOrEqual(height);
      seen.push(`${Math.round(guide.x)},${Math.round(guide.y)}`);
      const shadow = await page
        .locator('.tour-spot')
        .evaluate((el) => getComputedStyle(el).boxShadow);
      expect(shadow).toContain('rgba(18, 8, 30');
      if (targets[step]) {
        const spot = (await page.locator('.tour-spot').boundingBox())!;
        const target = (await page
          .locator(targets[step]!)
          .first()
          .boundingBox())!;
        // The spotlight wraps the real element.
        expect(spot.x).toBeLessThanOrEqual(target.x);
        expect(spot.y).toBeLessThanOrEqual(target.y);
        expect(spot.x + spot.width).toBeGreaterThanOrEqual(
          target.x + target.width,
        );
        // Compact targets must stay uncovered by the dialog.
        if (targets[step] !== '.shelf-row')
          expect(intersects(guide, target)).toBe(false);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (step < targets.length - 1)
        await page.getByRole('button', { name: 'Siguiente' }).click();
    }
    // Inti really moved between steps.
    expect(new Set(seen).size).toBeGreaterThan(2);
  });
}

test.describe('movimiento reducido', () => {
  test.use({ reducedMotion: 'reduce' });
  test('no hay animaciones activas en el guía', async ({ page }) => {
    await startGame(page);
    await page.locator('[data-product-id="2699"]').click();
    await page.waitForTimeout(300);
    const running = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((animation) =>
            (animation.effect as KeyframeEffect | null)?.target?.closest(
              '.guide-mascot',
            ),
          ).length,
    );
    expect(running).toBe(0);
  });
});
