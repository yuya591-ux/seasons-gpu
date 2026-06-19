import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
for (const id of ['kitaterao-rooftop', 'kitaterao-rooftop-night', 'summer-rain-night-downtown', 'summer-clear-noon']) {
  await page.evaluate((s) => window.__applyScene(s), id)
  await page.waitForTimeout(2600)
  await page.addStyleTag({ content: '.ui{display:none !important}' }).catch(() => {})
  await page.screenshot({ path: `scripts/_shots/hc-${id}.png` })
  console.log(id, 'done')
}
await browser.close()
