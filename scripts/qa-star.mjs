import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.goto('http://localhost:4875/seasons-gpu/?dev=1', { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })
await page.evaluate(() => window.__applyScene && window.__applyScene('summer-dusk-seaside'))
await page.waitForTimeout(2600)
// 3秒周期の強制発火を数フレーム撮り、流れ星の途中を捉える
for (let i = 0; i < 4; i++) { await page.waitForTimeout(750); await page.screenshot({ path: `scripts/_shots/qa-star-${i}.png` }) }
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0,4)) : 'エラー無し')
await browser.close()
