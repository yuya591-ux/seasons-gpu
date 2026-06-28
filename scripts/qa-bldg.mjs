// 建物の箱っぽさ調査: home上空低空＋街路の歩行目線で建物を撮る（実像で脱ローポリの要否を判断）。
import { chromium } from 'playwright'
const port = process.env.PORT || '5121'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 720, height: 520 }, deviceScaleFactor: 1.5 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.addStyleTag({ content: '.ui{display:none !important}' })
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(600)
await page.evaluate(() => window.__town3dCruise && window.__town3dCruise(false)); await page.waitForTimeout(200)
// ① home低空・斜め見下ろし（屋根と建物群の塊感）
const spots = [
  ['air-resi', 24, -40, 30, 0.3, -0.35],
  ['air-arcade', 0, -18, 22, 0.0, -0.3],
]
for (const [n, x, z, y, yaw, pit] of spots) {
  await page.evaluate(([x, y, z, yaw, pit]) => window.__town3dFlyPose(x, y, z, yaw, pit), [x, y, z, yaw, pit])
  await page.waitForTimeout(1200)
  await page.mouse.move(360, 260); await page.mouse.move(362, 262)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `scripts/_shots/bldg-${n}.png` })
  console.log('shot', n)
}
// ② 街路の歩行目線（建物の壁面・1階・軒）
const walk = [['walk-resi', 24, -40, 0.3], ['walk-arcade', 2, -10, 1.2]]
for (const [n, x, z, yaw] of walk) {
  const gy = await page.evaluate(([x, z]) => window.__town3dGroundAt(x, z), [x, z])
  await page.evaluate(([x, gy, z, yaw]) => window.__town3dFlyPose(x, gy + 6, z + 6, yaw, -0.12), [x, gy, z, yaw])
  await page.waitForTimeout(900)
  await page.evaluate(() => window.__town3dLand && window.__town3dLand(true)); await page.waitForTimeout(1300)
  await page.evaluate((y) => window.__town3dFaceWalk && window.__town3dFaceWalk(y), yaw)
  await page.waitForTimeout(900)
  await page.mouse.move(360, 260); await page.mouse.move(362, 262)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `scripts/_shots/bldg-${n}.png` })
  console.log('shot', n, 'gy', gy.toFixed(1))
  await page.evaluate(() => window.__town3dFly && window.__town3dFly(true)); await page.waitForTimeout(500)
}
await browser.close()
console.log('bldg survey done')
