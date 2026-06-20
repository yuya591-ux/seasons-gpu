// 上空から行き先の導線(光柱＋海路の光点)が読めるか確認。高所から東(江戸)・北(戦国)を見下ろす。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
const run = async (scene, tag) => {
  await page.evaluate((s) => window.__applyScene(s), scene)
  await page.waitForTimeout(2400)
  await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(700)
  await page.evaluate(() => { window.__town3dCruise(false) })
  // 高所から東(江戸)方向を見下ろす
  await page.evaluate(() => window.__town3dFlyPose(70, 96, -30, Math.PI / 2, -0.5)); await page.waitForTimeout(700)
  await page.screenshot({ path: `scripts/_shots/beacon-edo-${tag}.png` })
  // 高所から北(戦国)方向を見下ろす
  await page.evaluate(() => window.__town3dFlyPose(120, 100, -120, Math.PI, -0.5)); await page.waitForTimeout(700)
  await page.screenshot({ path: `scripts/_shots/beacon-sen-${tag}.png` })
}
await run('kitaterao-window-3d', 'day')
await run('kitaterao-window-3d-night', 'night')
console.log('beacon shots done')
await browser.close()
