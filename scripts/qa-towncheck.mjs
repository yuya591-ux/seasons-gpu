import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:4875/seasons-gpu/?dev=1', { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(500)
await page.addStyleTag({ content: '.ui{display:none !important}' })
// 角部屋: 街と屋根群を正面で
await page.evaluate(() => window.__applyScene && window.__applyScene('autumn-dusk-corner-room'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__renderer.setPanTarget(0, 0.3)) // 少し見下ろす
await page.waitForTimeout(900)
await page.screenshot({ path: 'scripts/_shots/tc-corner.png' })
// 3Dの街: 乗り出して街路を見下ろす（建物・住民が近い）
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2800)
await page.evaluate(() => window.__town3dLean && window.__town3dLean(true))
await page.waitForTimeout(5000)
await page.evaluate(() => window.__town3dSetView && window.__town3dSetView(0.15, -0.55))
await page.waitForTimeout(900)
await page.screenshot({ path: 'scripts/_shots/tc-town3d.png' })
console.log('done')
await browser.close()
