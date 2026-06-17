import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:4875/seasons/?dev=1', { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })
async function shot(id, file) {
  await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
  await page.waitForTimeout(2800)
  await page.screenshot({ path: `scripts/_shots/${file}.png` })
  console.log('撮影:', file)
}
await shot('shishigaya-window-3d-autumn', 'qa-yato-autumn')
await shot('shishigaya-morning-yato', 'qa-yato-summer')
await shot('shishigaya-window-3d-spring', 'qa-yato-spring')
await browser.close()
