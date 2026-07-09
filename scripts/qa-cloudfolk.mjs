// 雲海のひと気の確認。茶屋(40,-298)・灯籠市(-34,-366)へ寄り、人影が崩れず賑わいが出るか撮る。
import { chromium } from 'playwright'
const port = process.env.PORT || '5121'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })
async function fly(scene) {
  await page.evaluate((s) => window.__applyScene(s), scene)
  await page.waitForTimeout(2400)
  await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(300)
  await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(700)
  await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(300)
  await page.evaluate(() => { window.__town3dCruise(false); window.__town3dZoom(1.0) })
}
async function shot(label, pose) {
  await page.evaluate((p) => window.__town3dFlyPose(p[0], p[1], p[2], p[3], p[4]), pose)
  await page.waitForTimeout(1600)
  await page.mouse.move(320, 240); await page.mouse.move(322, 242)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `scripts/_shots/cloudfolk-${label}.png` })
  console.log(label, 'done')
}
await fly('kitaterao-window-3d')  // 夕方
await shot('teahouse', [40, 114, -283, 0, -0.34])
await shot('market', [-34, 116, -349, 0, -0.36])
await shot('market-side', [-22, 113, -360, -0.7, -0.22])
await fly('kitaterao-window-3d-rain-night') // 夜（提灯が灯る灯籠市）
await shot('market-night', [-34, 116, -349, 0, -0.36])
await browser.close()
console.log('check done')
