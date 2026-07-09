// 夜の光柱(godshaft)＋かもめ(gull)の確認。
import { chromium } from 'playwright'
const port = process.env.PORT || '5121'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 760, height: 440 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui,[class*="toast"],[class*="hint"],[class*="cruise"]{display:none !important}' })
async function fly(scene) {
  await page.evaluate((s) => window.__applyScene(s), scene); await page.waitForTimeout(2600)
  await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(400)
  await page.evaluate(() => { window.__town3dCruise && window.__town3dCruise(false); window.__town3dZoom && window.__town3dZoom(1.0) }); await page.waitForTimeout(200)
}
async function shot(label, pose, w) {
  await page.evaluate((p) => window.__town3dFlyPose(p[0], p[1], p[2], p[3], p[4]), pose)
  await page.waitForTimeout(w || 1500); await page.mouse.move(380, 220); await page.mouse.move(382, 222); await page.waitForTimeout(250)
  await page.screenshot({ path: `scripts/_shots/sg-${label}.png` }); console.log(label, 'done')
}
// 夜の雲海の光柱（ユーザー画像に近い低い視点で群島中心を見る）
await fly('kitaterao-window-3d-rain-night')
await shot('shaft-night', [-30, 96, -250, 0, 0.05])
await shot('shaft-night2', [-12, 99, -262, -0.3, 0.0])
// かもめ（湾の海鳥。昼に湾(88,-42)へ寄って見る）
await fly('kitaterao-window-3d')
await shot('gull', [78, 18, -42, 1.4, -0.02])
await shot('gull2', [80, 22, -30, 1.7, -0.1])
await browser.close()
console.log('check done')
