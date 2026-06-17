import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.goto('http://localhost:4875/seasons/?dev=1', { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })
for (const [id, f] of [['summer-clear-noon','qa-sh-clearnoon'],['summer-dusk-downtown','qa-sh-downtown'],['summer-rain-night','qa-sh-rainnight']]) {
  await page.evaluate((s) => window.__applyScene && window.__applyScene(s), id)
  await page.waitForTimeout(2900)
  await page.screenshot({ path: `scripts/_shots/${f}.png` })
  console.log('撮影:', f)
}
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0,4)) : 'エラー無し')
await browser.close()
