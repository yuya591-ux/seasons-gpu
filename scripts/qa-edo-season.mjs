// 城下町の四季: 春(桜)・秋(紅葉)・冬(雪)で城の表情を確認。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
const E = Math.PI / 2
const fly = async () => { await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(300); await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(300); await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(700); await page.evaluate(() => { window.__town3dCruise(false) }); await page.waitForTimeout(150) }
const tour = async (sceneId, name) => {
  await page.evaluate((s) => window.__applyScene(s), sceneId); await page.waitForTimeout(2400)
  await fly()
  await page.evaluate(([e]) => window.__town3dFlyPose(252, 28, -30, e, -0.10), [E]); await page.waitForTimeout(800); await page.screenshot({ path: `scripts/_shots/${name}-near.png` })
  await page.evaluate(([e]) => window.__town3dFlyPose(262, 36, -30, e, -0.22), [E]); await page.waitForTimeout(800); await page.screenshot({ path: `scripts/_shots/${name}-top.png` })
}
await tour('kitaterao-window-3d-spring', 'edo-spring')
await tour('kitaterao-window-3d-snow', 'edo-snow')
await tour('kitaterao-window-3d-autumn', 'edo-autumn')
console.log('edo season shots done')
await browser.close()
