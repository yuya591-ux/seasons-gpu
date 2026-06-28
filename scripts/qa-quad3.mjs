import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4896
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 600, height: 540 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
// 隔離レンダで造形を確認（犬/猫=小, 馬=大）
const cases = [
  ['cat', 0x8a7a5a, 0.5, 2.1],
  ['dog', 0x5a5a5e, 0.55, 2.1],
  ['horse', 0x5a4030, 1.1, 2.1],
  ['dogside', 0xc8b89a, 0.62, 1.57],
]
for (const [label, col, sc, yaw] of cases) {
  const dat = await page.evaluate(({ col, sc, yaw }) => window.__town3dQuadShot(col, sc, yaw), { col, sc, yaw })
  writeFileSync(`scripts/_shots/quad3_${label}.png`, Buffer.from(dat.split(',')[1], 'base64'))
  console.log(label, 'done')
}
await browser.close()
