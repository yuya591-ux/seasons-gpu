import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 1 })
await page.emulateMedia({ reducedMotion: 'reduce' }) // OSの「視差効果を減らす」を再現
const errs = []
page.on('pageerror', (e) => errs.push('PE:' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text()) })
await page.goto('http://localhost:4875/seasons/?dev=1', { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(500)
for (const id of ['summer-rain-night-downtown', 'autumn-rain-night-corner-room', 'kitaterao-window-3d-night', 'summer-dusk-seaside']) {
  await page.evaluate((s) => window.__applyScene && window.__applyScene(s), id)
  await page.waitForTimeout(2500)
}
const rm = await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
console.log('reduce-motion有効:', rm, '/', errs.length ? 'エラー:' + JSON.stringify(errs.slice(0,4)) : 'エラー無し（全情景コンパイル/描画OK）')
await browser.close()
