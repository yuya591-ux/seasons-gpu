// 天の井戸(cwNodes well: x=90,z=-340,topY≈107)の作り込み確認。雲海の島の高さへ飛び、井戸を間近に捉える。
// 高所でしか動かない skyDrifters['well'] 分岐のランタイムエラー検知も兼ねる。昼/夜の両方で。
import { chromium } from 'playwright'
const port = process.env.PORT || '5009'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 600, height: 460 }, deviceScaleFactor: 2 })
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
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `scripts/_shots/well-${label}.png` })
  console.log(label, 'done')
}
// 夜（灯が映える）。井戸は (90,107,-340)。yaw=0 で -z(井戸)方向を向く。
await fly('kitaterao-window-3d-rain-night')
await shot('night-near', [90, 112, -324, 0, -0.34])   // 北の井戸を見下ろす（光の柱・灯・滑車）
await shot('night-peek', [90, 115, -331, 0, -0.62])   // 真上気味に覗き込む（暗い水面に瞬く下界の灯）
await shot('night-side', [107, 111, -340, -Math.PI / 2, -0.24]) // 横から（縄・滑車・石灯籠）
// 昼（造形の確認）
await fly('kitaterao-window-3d-rain')
await shot('day-near', [90, 112, -324, 0, -0.34])
await browser.close()
console.log('check done')
