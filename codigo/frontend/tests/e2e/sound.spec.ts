import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

// Taps everything sent to the speakers so the test can measure real signal.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pictomarket.intro.seen', '1');
    const state = window as unknown as { peak: () => number };
    const connect = AudioNode.prototype.connect;
    const analysers: AnalyserNode[] = [];
    const taps = new WeakMap<BaseAudioContext, AnalyserNode>();
    AudioNode.prototype.connect = function (this: AudioNode, ...args: any[]) {
      const target = args[0] as unknown;
      if (target instanceof AudioDestinationNode) {
        let tap = taps.get(this.context);
        if (!tap) {
          tap = this.context.createAnalyser();
          taps.set(this.context, tap);
          analysers.push(tap);
        }
        connect.apply(this, [tap] as never);
      }
      return connect.apply(this, args as never);
    } as typeof AudioNode.prototype.connect;
    state.peak = () =>
      Math.max(
        0,
        ...analysers.map((analyser) => {
          const data = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(data);
          return Math.max(...data.map(Math.abs));
        }),
      );
  });
});

/** Highest sample heard over about two seconds. */
async function loudest(page: Page) {
  let peak = 0;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(100);
    peak = Math.max(
      peak,
      await page.evaluate(() =>
        (window as unknown as { peak: () => number }).peak(),
      ),
    );
  }
  return peak;
}

test('cada parte tiene su música y suena de verdad sin saturar', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const toggle = page.locator('.sound-toggle');
  await expect(toggle).toHaveAttribute('data-sound-track', 'home');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-label', 'Silenciar música');
  const levels: Record<string, number> = {};
  levels.home = await loudest(page);

  await page.getByRole('button', { name: 'EMPEZAR' }).click();
  await expect(toggle).toHaveAttribute('data-sound-track', 'game');
  await page.waitForTimeout(1500); // cross-fade
  levels.game = await loudest(page);

  await page.getByRole('button', { name: 'Panel del terapeuta' }).click();
  await expect(toggle).toHaveAttribute('data-sound-track', 'therapist');
  await page.waitForTimeout(1500);
  levels.therapist = await loudest(page);
  await page
    .getByRole('button', { name: 'Cerrar panel del terapeuta' })
    .click();

  for (const id of [8655, 2503, 2594, 2446])
    await page.locator(`[data-product-id="${id}"]`).click();
  await expect(toggle).toHaveAttribute('data-sound-track', 'celebration');
  await page.waitForTimeout(1500);
  levels.celebration = await loudest(page);

  console.log('peak levels', JSON.stringify(levels));
  for (const level of Object.values(levels)) {
    expect(level).toBeGreaterThan(0.005);
    expect(level).toBeLessThan(0.99);
  }

  await toggle.click();
  await page.waitForTimeout(2000);
  expect(await loudest(page)).toBeLessThan(0.002);
  expect(errors).toEqual([]);
});

for (const width of [320, 375, 768, 1280]) {
  test(`el botón de música no rompe la barra a ${width}px`, async ({
    page,
  }) => {
    await mkdir('artifacts', { recursive: true });
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    for (const screen of ['home', 'game']) {
      if (screen === 'game')
        await page.getByRole('button', { name: 'EMPEZAR' }).click();
      const box = (await page.locator('.sound-toggle').boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({ path: `artifacts/sound-${screen}-${width}.png` });
    }
    await page.getByRole('button', { name: 'Panel del terapeuta' }).click();
    await expect(
      page.getByRole('checkbox', { name: 'Música de fondo' }),
    ).toBeAttached();
  });
}
