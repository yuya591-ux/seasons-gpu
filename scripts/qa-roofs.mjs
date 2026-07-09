import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', (e) => errs.push('PE:' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text()) })
await page.goto('http://localhost:4875/seasons-gpu/?dev=1', { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(500)
await page.addStyleTag({ content: '.ui{display:none !important}' })
// 角部屋: 屋根群を見下ろす
await page.evaluate(() => window.__applyScene && window.__applyScene('autumn-dusk-corner-room'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__renderer.setPanTarget(0, 0.3)); await page.waitForTimeout(900)
await page.screenshot({ path: 'scripts/_shots/qa-roofs-corner.png' })
// 下町(2D shader)も同じ地面を使う
await page.evaluate(() => window.__applyScene && window.__applyScene('summer-dusk-downtown'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__renderer.setPanTarget(0, 0.3)); await page.waitForTimeout(900)
await page.screenshot({ path: 'scripts/_shots/qa-roofs-downtown.png' })
// 屋上
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-rooftop'))
await page.waitForTimeout(2600)
await page.screenshot({ path: 'scripts/_shots/qa-roofs-rooftop.png' })
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0,4)) : 'エラー無し（全情景コンパイル/描画OK）')
await browser.close()
