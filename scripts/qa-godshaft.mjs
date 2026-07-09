// 天上界の光芒（天使の梯子）が雲海に立つか確認。群島(中心-30,-320)の上を望む構図。高所のみ。
import { chromium } from 'playwright'
const port = process.env.PORT || '5099'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 640, height: 460 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })
async function fly(scene) {
  await page.evaluate((s) => window.__applyScene(s), scene)
  await page.waitForTimeout(2300)
  await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(300)
  await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(700)
  await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(300)
  await page.evaluate(() => { window.__town3dCruise(false); window.__town3dZoom(1.0) })
}
async function shot(label, pose) {
  await page.evaluate((p) => window.__town3dFlyPose(p[0], p[1], p[2], p[3], p[4]), pose)
  await page.waitForTimeout(1700)
  await page.screenshot({ path: `scripts/_shots/godshaft-${label}.png` })
  console.log(label, 'done')
}
await fly('kitaterao-window-3d')                  // 夕方
await shot('dusk-wide', [-30, 120, -208, 0, 0.05]) // 群島中心の光の柱を望む
await shot('dusk-near', [10, 126, -270, -0.5, 0.02])
await fly('kitaterao-window-3d-rain-night')        // 夜
await shot('night-wide', [-30, 120, -208, 0, 0.05])
await browser.close()
console.log('check done')
