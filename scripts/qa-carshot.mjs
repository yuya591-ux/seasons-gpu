import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4896
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 560, height: 420 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
for (const [label, col] of [['blue', 0x3a5a7a], ['red', 0xb0564a]]) {
  const dat = await page.evaluate((c) => window.__town3dCarShot(c), col)
  writeFileSync(`scripts/_shots/carshot_${label}.png`, Buffer.from(dat.split(',')[1], 'base64'))
  console.log(label, 'done')
}
await browser.close()
