import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.goto('http://localhost:4875/seasons/?dev=1', { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(500)
await page.addStyleTag({ content: '.ui{display:none !important}' })
for (const [id,f] of [['shishigaya-window-3d-spring','qa-water-spring'],['shishigaya-window-3d-autumn','qa-water-autumn']]) {
  await page.evaluate((s) => window.__applyScene && window.__applyScene(s), id)
  await page.waitForTimeout(2900)
  await page.evaluate(() => window.__town3dLean && window.__town3dLean(true))
  await page.waitForTimeout(5000)
  await page.evaluate(() => window.__town3dSetView && window.__town3dSetView(0, -0.5))
  await page.waitForTimeout(900)
  await page.screenshot({ path: `scripts/_shots/${f}.png` })
  await page.evaluate(() => window.__town3dLean && window.__town3dLean(false))
  await page.waitForTimeout(300)
}
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0,4)) : 'エラー無し')
await browser.close()
