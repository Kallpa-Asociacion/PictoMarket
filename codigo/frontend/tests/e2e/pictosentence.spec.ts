import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('pictomarket.intro.seen', '1'),
  );
});

for (const width of [320, 768, 1280]) {
  test(`la oración de pictogramas se ve sin desbordar a ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'EMPEZAR' }).click();
    const sentence = page.locator('.picto-sentence');
    await expect(sentence).toBeVisible();
    await expect(sentence).toHaveAttribute('aria-hidden', 'true');
    await expect(sentence.locator('.picto-caption').first()).toHaveText(
      'BUSCAR',
    );
    await expect(page.locator('.instruction-text')).toContainText('Busca:');
    await expect
      .poll(() =>
        sentence
          .locator('img')
          .evaluateAll(
            (images) =>
              images.length > 0 &&
              images.every(
                (image) => (image as HTMLImageElement).naturalWidth > 0,
              ),
          ),
      )
      .toBe(true);
    const box = await sentence.locator('img').first().boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(56);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
