// 空の無人駅(cwNodes station: x=120,z=-312,topY≈106)の確認。線路が雲へ消える終着の構図＋プラットフォーム。
import { chromium } from 'playwright'
const port = process.env.PORT || '5085'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 620, height: 460 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })
async function fly(scene) {
  await page.evaluate((s) => window.__applyScene(s), scene)
  await page.waitForTimeout(2300)
  await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(300)
  await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(800)
  await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(300)
  await page.evaluate(() => { window.__town3dCruise(false); window.__town3dZoom(1.0) })
}
async function shot(label, pose) {
  await page.evaluate((p) => window.__town3dFlyPose(p[0], p[1], p[2], p[3], p[4]), pose)
  await page.waitForTimeout(1700)
  await page.screenshot({ path: `scripts/_shots/station-${label}.png` })
  console.log(label, 'done')
}
await fly('kitaterao-window-3d')              // 夕方（裸電球が灯る前/淡い）
await shot('day-rail', [118, 108, -312, Math.PI / 2, -0.05]) // 線路に沿って東を見る＝雲へ消える終着
await shot('day-front', [108, 113, -300, 0.9, -0.26])        // 斜め前からプラットフォーム/ベンチ/駅名標/時計
await fly('kitaterao-window-3d-rain-night')   // 夜（裸電球が灯る）
await shot('night-rail', [104, 113, -312, Math.PI / 2, -0.06])
await browser.close()
console.log('check done')
