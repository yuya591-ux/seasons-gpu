import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:4875/seasons/?dev=1', { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })
const ids = [
  'summer-dusk-seaside', 'summer-morning-mountains',
  'autumn-dusk-corner-room', 'spring-dusk-corner-room', 'summer-morning-corner-room',
]
for (const id of ids) {
  await page.evaluate((s) => window.__applyScene && window.__applyScene(s), id)
  await page.waitForTimeout(2800)
  await page.screenshot({ path: `scripts/_shots/qs-${id}.png` })
  console.log('撮影:', id)
}
await browser.close()
