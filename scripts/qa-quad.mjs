import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4896
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 2 })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(600)
await page.evaluate(() => window.__town3dCruise(false)); await page.waitForTimeout(300)
console.log('quadCount', await page.evaluate(()=>window.__town3dQuadCount()))
await page.evaluate(() => window.__town3dFlyPose(0, 2.2, 8, 0, -0.12)); await page.waitForTimeout(1500)
for (const i of [0,1,2]) { await page.evaluate((i)=>window.__town3dQuadFront(i, 3.5), i); await page.waitForTimeout(800); await page.screenshot({ path: `scripts/_shots/quad_${i}.png` }); console.log('q',i) }
await browser.close()
