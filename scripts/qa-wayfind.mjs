// 行き先の気配: 街から飛び立つと、東=澪標／北=朱の鳥居の海路が方角を示す。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
const tour = async (sceneId, suffix) => {
  await page.evaluate((s) => window.__applyScene(s), sceneId); await page.waitForTimeout(2400)
  await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(300)
  await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(300)
  await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(700)
  await page.evaluate(() => { window.__town3dCruise(false) }); await page.waitForTimeout(150)
  await page.evaluate(() => window.__town3dFlyPose(96, 22, -30, Math.PI / 2, -0.04)); await page.waitForTimeout(800); await page.screenshot({ path: `scripts/_shots/wayfind-east-${suffix}.png` })
  await page.evaluate(() => window.__town3dFlyPose(120, 25, -48, 0, -0.06)); await page.waitForTimeout(800); await page.screenshot({ path: `scripts/_shots/wayfind-north-${suffix}.png` })
}
await tour('kitaterao-window-3d', 'day')
await tour('kitaterao-window-3d-snow', 'night') // 雪夜で灯りも確認
console.log('wayfind shots done')
await browser.close()
