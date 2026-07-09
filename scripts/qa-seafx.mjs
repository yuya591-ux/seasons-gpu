// 海辺の強化確認。砂浜の汀（昼）と、夜に回る灯台の光芒。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
async function fly(scene) {
  await page.evaluate((s) => window.__applyScene && window.__applyScene(s), scene)
  await page.waitForTimeout(2400)
  await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(900)
  await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1100)
  await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(300)
  await page.evaluate(() => window.__town3dCruise(false))
}
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.addStyleTag({ content: '.ui{display:none !important}' })

// 昼の汀（海→砂浜→街）
await fly('kitaterao-window-3d')
await page.evaluate(() => { window.__town3dZoom(1.2); window.__town3dFlyPose(90, 9, -52, -1.5, -0.28) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/seafx-0-beach.png' })

// 夜の灯台の光芒（沖側から灯台を見る）
await fly('kitaterao-window-3d-night')
await page.evaluate(() => { window.__town3dZoom(0.9); window.__town3dFlyPose(103, 7, -26, -1.57, 0.02) })
await page.waitForTimeout(800)
await page.screenshot({ path: 'scripts/_shots/seafx-1-beam.png' })
await page.waitForTimeout(1100) // 光芒が回るので別の瞬間
await page.screenshot({ path: 'scripts/_shots/seafx-2-beam2.png' })

await browser.close()
console.log('seafx shots done')
