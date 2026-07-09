// 角部屋の初期フレーミング（窓枠が余裕を持って見えるか）を確認。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(500)
for (const s of ['autumn-dusk-corner-room', 'summer-morning-corner-room']) {
  await page.evaluate((id) => window.__applyScene && window.__applyScene(id), s)
  await page.waitForTimeout(2600)
  await page.screenshot({ path: `scripts/_shots/cornerframe-${s}.png` })
}
console.log('cornerframe shots done')
await browser.close()
