// 雲海の島（棚田 paddy: 58,-334,topY110／灯籠市 market: -34,-366,topY108）の作り込み確認。
import { chromium } from 'playwright'
const port = process.env.PORT || '5009'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 620, height: 470 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
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
  await page.screenshot({ path: `scripts/_shots/cw-${label}.png` })
  console.log(label, 'done')
}
await fly('kitaterao-window-3d-rain')   // 夕方（棚田の水鏡に夕陽／野花の色／茶屋・見晴らし台の造形）
await shot('paddy-day', [58, 117, -315, 0, -0.42])
await shot('teahouse-day', [40, 115, -281, 0, -0.38])  // 茶屋(40,-298)の正面（暖簾・縁台・茶器・幟）
await shot('lookout-day', [-62, 119, -253, 0, -0.40])   // 見晴らし台(-62,-270)の欄干・望遠鏡
await fly('kitaterao-window-3d-rain-night') // 夜（灯籠市・提灯が灯る）
await shot('market-night', [-34, 116, -345, 0, -0.42])
await shot('teahouse-night', [40, 115, -281, 0, -0.38])
await shot('paddy-night', [58, 117, -315, 0, -0.42])
await browser.close()
console.log('check done')
