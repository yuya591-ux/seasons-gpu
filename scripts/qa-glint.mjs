// 水面の太陽きらめき(きらめきの道)を実グレード+Bloom込みで確認する一時スクリプト。
import { chromium } from 'playwright'
const port = process.env.PORT || '4988'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 600, height: 320 }, deviceScaleFactor: 2 })
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
  await page.evaluate(() => { window.__town3dCruise(false); window.__town3dZoom(1.1) })
}
async function shot(label, pose) {
  await page.evaluate((p) => window.__town3dFlyPose(p[0], p[1], p[2], p[3], p[4]), pose)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `scripts/_shots/glint-${label}.png` })
  console.log(label, 'done')
}
// qa-seafxの渚ポーズ(海が前景に映る)を時間帯違いで。海面の太陽きらめきを見る。
await fly('kitaterao-window-3d-sunset')
await shot('sunset', [90, 9, -52, -1.5, -0.30])
await fly('kitaterao-window-3d')
await shot('noon', [90, 9, -52, -1.5, -0.30])
await browser.close()
console.log('glint check done')
