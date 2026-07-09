// 灯籠流しの確認。灯籠市(-34,-366)手前の雲海(-34,~88,-346)に紙灯籠が流れるか。夕/夜で。
import { chromium } from 'playwright'
const port = process.env.PORT || '5121'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 680, height: 520 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui,[class*="toast"],[class*="hint"],[class*="cruise"]{display:none !important}' })
async function fly(scene) {
  await page.evaluate((s) => window.__applyScene(s), scene); await page.waitForTimeout(2400)
  await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(250)
  await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(600)
  await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(250)
  await page.evaluate(() => { window.__town3dCruise(false); window.__town3dZoom(1.0) })
}
async function shot(label, pose) {
  await page.evaluate((p) => window.__town3dFlyPose(p[0], p[1], p[2], p[3], p[4]), pose)
  await page.waitForTimeout(1400); await page.mouse.move(340, 260); await page.mouse.move(342, 262); await page.waitForTimeout(250)
  await page.screenshot({ path: `scripts/_shots/toro-${label}.png` }); console.log(label, 'done')
}
await fly('kitaterao-window-3d')               // 夕方
await shot('dusk', [-34, 100, -330, 0, -0.5])   // 灯籠流しを見下ろす（市の手前）
await fly('kitaterao-window-3d-rain-night')     // 夜（灯る）
await shot('night', [-34, 100, -330, 0, -0.5])
await shot('night2', [-20, 97, -338, -0.8, -0.4])
await browser.close()
console.log('check done')
