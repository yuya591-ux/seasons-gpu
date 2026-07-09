import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4896
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 700, height: 520 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
// 中央通りを斜め上から俯瞰（建物より高く＝遮蔽を避け、駐車車両の車輪まで見える）
const shots = [
  ['hi1', [9, 11, -24], [1, 1, -40]],
  ['hi2', [-9, 10, -50], [-1, 1, -34]],
  ['hi3', [7, 7, -16], [2.5, 1.0, -30]],
]
for (const [label, c, l] of shots) {
  const dat = await page.evaluate(({ c, l }) => {
    const gy = window.__town3dGroundAt(l[0], l[2])
    return window.__town3dShotAt(c[0], gy + c[1], c[2], l[0], gy + l[1], l[2], 50)
  }, { c, l })
  writeFileSync(`scripts/_shots/car_${label}.png`, Buffer.from(dat.split(',')[1], 'base64'))
  console.log(label, 'done')
}
await browser.close()
