import { expect, test } from '@playwright/test';

type Debug = { slugs: string[]; render: (slug: string, seconds: number) => Promise<{ peak: number; rms: number; seconds: number }> };

test('every universe soundtrack renders audible audio without clipping', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  const slugs = await page.evaluate(() => (window as unknown as { __fandomMusic: Debug }).__fandomMusic.slugs);
  expect(slugs).toEqual(expect.arrayContaining(['harry-potter', 'supernatural', 'marvel', 'dc', 'star-wars', 'greys-anatomy', 'station-19', 'bts']));
  for (const slug of slugs) {
    // Two passes of the loop include the intro, drums and melody layers.
    const r = await page.evaluate((s) => (window as unknown as { __fandomMusic: Debug }).__fandomMusic.render(s, 40), slug);
    expect(r.rms, `${slug} too quiet`).toBeGreaterThan(0.01);
    expect(r.peak, `${slug} clips`).toBeLessThan(0.98);
  }
});

test('soundtrack follows the universe: starts on interaction, switches, mutes and stops outside', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('fandom.locale', 'pt-BR'));
  await page.goto('/universes');
  await expect(page.getByTestId('universe-music')).toHaveCount(0);
  await page.locator('a[href="/universes/harry-potter"]').first().click();
  const widget = page.getByTestId('universe-music');
  await expect(widget).toHaveAttribute('data-state', 'playing');
  await expect(widget).toContainText('Castelo encantado');
  await expect(widget).toContainText('Trilha original Fandom Universe');

  // Keeps playing inside the universe's pages; switches theme in another universe.
  await page.getByRole('tab', { name: 'Arquivo' }).click();
  await expect(widget).toHaveAttribute('data-state', 'playing');
  await page.goto('/universes/bts');
  await expect(widget).toContainText('Brilho roxo');
  await expect(widget).toHaveAttribute('data-state', 'waiting'); // a full reload needs a new interaction
  await page.getByRole('heading', { name: 'BTS', level: 1 }).click();
  await expect(widget).toHaveAttribute('data-state', 'playing');

  // Mute is remembered on this device.
  await page.getByRole('button', { name: 'Silenciar trilha sonora' }).click();
  await expect(widget).toHaveAttribute('data-state', 'muted');
  await page.reload();
  await expect(page.getByTestId('universe-music')).toHaveAttribute('data-state', 'muted');
  await page.getByRole('button', { name: 'Tocar trilha sonora' }).click();
  await expect(page.getByTestId('universe-music')).toHaveAttribute('data-state', 'playing');

  await page.getByRole('link', { name: 'Universos' }).first().click();
  await expect(page.getByTestId('universe-music')).toHaveCount(0);
});
