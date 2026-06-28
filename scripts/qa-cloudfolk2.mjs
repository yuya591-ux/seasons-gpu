// 雲海のひと気を接近確認（人影が崩れないか）。トーストも隠す。
import { chromium } from 'playwright'
const port = process.env.PORT || '5121'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui,.toast,.hint,.modepill,[class*="toast"],[class*="hint"]{display:none !important}' })
async function fly(scene) {
  await page.evaluate((s) => window.__applyScene(s), scene)
  await page.waitForTimeout(2400)
  await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(250)
  await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(600)
  await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(250)
  await page.evaluate(() => { window.__town3dCruise(false); window.__town3dZoom(1.0) })
}
async function shot(label, pose) {
  await page.evaluate((p) => window.__town3dFlyPose(p[0], p[1], p[2], p[3], p[4]), pose)
  await page.waitForTimeout(1500)
  await page.mouse.move(320, 240); await page.mouse.move(322, 242)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `scripts/_shots/cf2-${label}.png` })
  console.log(label, 'done')
}
await fly('kitaterao-window-3d')
await shot('teahouse', [40, 111, -288, 0, -0.2])     // 茶屋へ接近（縁台の二人）
await shot('market', [-34, 110, -357, 0, -0.16])     // 灯籠市へ接近（そぞろ歩き・床几・店番）
await fly('kitaterao-window-3d-rain-night')
await shot('market-night', [-34, 110, -357, 0, -0.16])
await browser.close()
console.log('check done')
