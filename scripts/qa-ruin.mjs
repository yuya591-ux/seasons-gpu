// 鶴(群島の上を旋回)の確認＋高所ランタイムエラー検知。鶴は中心(-30,-320)半径120付近 y~120。
import { chromium } from 'playwright'
const port = process.env.PORT || '4989'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 600, height: 420 }, deviceScaleFactor: 2 })
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
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `scripts/_shots/ruin-${label}.png` })
  console.log(label, 'done')
}
await fly('kitaterao-window-3d')
await shot('crane-a', [-30, 122, -200, 0, -0.05])   // 群島中心を望み旋回する鶴を捉える
await shot('crane-b', [60, 124, -300, -1.3, -0.05])
await browser.close()
console.log('check done')
