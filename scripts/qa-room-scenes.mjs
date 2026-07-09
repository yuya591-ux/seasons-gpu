// 夜・谷戸でも3D室内窓枠が破綻しないか（窓を閉じた部屋の中・中央）。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
for (const [id, label] of [['kitaterao-window-3d-night', 'night'], ['shishigaya-window-3d', 'yato']]) {
  await page.evaluate((s) => window.__applyScene(s), id)
  await page.waitForTimeout(2400)
  await page.screenshot({ path: `scripts/_shots/room-${label}.png` })
  console.log(label, 'done')
}
await browser.close()
