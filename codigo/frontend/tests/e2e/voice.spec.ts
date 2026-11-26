import { expect, test, type Page } from '@playwright/test';

// Inti's recorded voice must be the only one ever heard.
async function instrument(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('pictomarket.intro.seen', '1');
    const w = window as unknown as { heard: string[]; browser: string[] };
    w.heard = [];
    w.browser = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      const src = this.src;
      return play.call(this).then(() => {
        w.heard.push(src);
      });
    };
    window.speechSynthesis.speak = (utterance) => {
      w.browser.push(utterance.text);
    };
  });
}
const read = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { heard: string[]; browser: string[] };
    return { heard: w.heard.length, browser: w.browser };
  });

for (const [name, blocked] of [
  ['con todos los audios', null],
  ['aunque fallen audios en la red', /tomate-va-al-carrito|lo-lograste/],
] as const)
  test(`solo habla Inti ${name}`, async ({ page }) => {
    test.setTimeout(90000);
    await instrument(page);
    if (blocked) await page.route(blocked, (route) => route.abort());
    await page.goto('/');
    await page
      .getByRole('button', { name: 'Activar voz y escuchar a Inti' })
      .click();
    await expect.poll(async () => (await read(page)).heard).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'EMPEZAR' }).click();
    await expect(page.getByLabel('Voz en español')).toBeAttached();
    expect(
      await page
        .getByLabel('Voz en español')
        .locator('option')
        .allTextContents(),
    ).toEqual([expect.stringContaining('Inti (voz grabada)')]);
    // Tomato first, then the rest, listening to each message.
    for (const id of [2594, 8655, 2503, 2446]) {
      const before = (await read(page)).heard;
      await page.locator(`[data-product-id="${id}"]`).click();
      await expect
        .poll(async () => (await read(page)).heard, { timeout: 15000 })
        .toBeGreaterThan(before);
      await page.waitForTimeout(5000);
    }
    const result = await read(page);
    console.log(name, JSON.stringify(result));
    expect(result.browser).toEqual([]);
    expect(result.heard).toBeGreaterThanOrEqual(blocked ? 12 : 14);
  });
