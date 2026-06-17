import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.goto('http://localhost:4875/seasons/?dev=1', { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(500)
await page.addStyleTag({ content: '.ui{display:none !important}' })
for (const [id,f] of [['kitaterao-window-3d','qa-sky-noon'],['summer-dusk-downtown','qa-sky-dusk'],['kitaterao-window-3d-night','qa-sky-night']]) {
  await page.evaluate((s) => window.__applyScene && window.__applyScene(s), id)
  await page.waitForTimeout(2800)
  await page.screenshot({ path: `scripts/_shots/${f}.png` })
}
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0,4)) : 'エラー無し')
await browser.close()
