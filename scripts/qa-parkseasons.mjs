// 季節ごとの公園の確認。春=桜満開・夏=緑・秋=紅葉・冬=雪＋氷の池。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })

const scenes = [
  ['kitaterao-window-3d-spring', 'spring'],
  ['kitaterao-window-3d', 'summer'],
  ['kitaterao-window-3d-autumn', 'autumn'],
  ['kitaterao-window-3d-snow', 'winter'],
]
for (const [id, label] of scenes) {
  await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
  await page.waitForTimeout(2400)
  await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(900)
  await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1100)
  await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(300)
  await page.evaluate(() => { window.__town3dCruise(false); window.__town3dZoom(1.1); window.__town3dFlyPose(24, 13, -13, -0.95, -0.42) })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `scripts/_shots/parkseason-${label}.png` })
  console.log('撮影:', label)
}
await browser.close()
console.log('parkseasons shots done')
