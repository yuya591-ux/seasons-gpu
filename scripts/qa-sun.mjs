// 太陽の本体(円盤)の見え方を実グレード+Bloom込みで確認する一時スクリプト。
import { chromium } from 'playwright'
const port = process.env.PORT || '4988'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 600, height: 360 }, deviceScaleFactor: 2 })
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
  await page.waitForTimeout(1100)
  await page.screenshot({ path: `scripts/_shots/sun-${label}.png` })
  console.log(label, 'done')
}
// 太陽は sunDir(0.06,0.26,-1) ＝ -z 方向のやや上。yaw0=-z を向き、pitch を上げて空を見る。
await fly('kitaterao-window-3d-sunset')
await shot('sunset', [0, 44, 80, 0, 0.16])
await fly('kitaterao-window-3d')
await shot('noon', [0, 44, 80, 0, 0.16])
await browser.close()
console.log('sun check done')
