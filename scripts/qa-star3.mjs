import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', (e) => errs.push('PE: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE: ' + m.text()) })
await page.goto('http://localhost:4875/seasons-gpu/?dev=1', { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(500)
for (const id of ['summer-rain-night-downtown','winter-snow-night-downtown','autumn-rain-night-corner-room','summer-dusk-downtown','autumn-dusk-corner-room']) {
  await page.evaluate((s) => window.__applyScene && window.__applyScene(s), id)
  await page.waitForTimeout(1800)
}
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0,8)) : 'エラー無し（全5情景コンパイル/描画OK）')
await browser.close()
