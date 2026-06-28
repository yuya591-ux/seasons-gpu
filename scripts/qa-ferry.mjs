// 空の渡し舟の確認。雲海上の舟＋舟人が崩れず巡るか。ferry初期位置≈(56,88,-315)。
import { chromium } from 'playwright'
const port = process.env.PORT || '5121'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 680, height: 480 }, deviceScaleFactor: 2 })
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
async function shot(label, pose, waitMs) {
  await page.evaluate((p) => window.__town3dFlyPose(p[0], p[1], p[2], p[3], p[4]), pose)
  await page.waitForTimeout(waitMs || 1500)
  await page.mouse.move(340, 240); await page.mouse.move(342, 242)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `scripts/_shots/ferry-${label}.png` })
  console.log(label, 'done')
}
await fly('kitaterao-window-3d')
await shot('near', [56, 100, -288, 0, -0.26])     // 渡し舟へ寄る
await shot('wide', [40, 116, -260, -0.2, -0.34])   // 雲海と島々を背景に渡し舟
await browser.close()
console.log('check done')
