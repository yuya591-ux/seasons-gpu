import { chromium } from 'playwright'
const PORT = process.env.PORT || 4877
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 820 }, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', (e) => errs.push('PE:'+e.message))
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1&fest=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('summer-night-downtown'))
await page.waitForTimeout(3000)
await page.screenshot({ path: 'scripts/_shots/festlive_window.png' })
// 飛べるか
const flyOk = await page.evaluate(() => { window.__town3dFly && window.__town3dFly(true); return !!(window.__town3dDbg && window.__town3dDbg()) })
console.log('flyOk', flyOk, 'errs', errs.slice(0,3))
await page.waitForTimeout(800)
if (flyOk) { await page.evaluate(() => window.__town3dCruise(false)); await page.evaluate(() => window.__town3dFlyPose(0, 8, 22, 0, -0.2)); await page.waitForTimeout(2200); await page.screenshot({ path: 'scripts/_shots/festlive_fly.png' }) }
const fc = await page.evaluate(() => window.__town3dFolkCount && window.__town3dFolkCount())
console.log('folk', fc)
await browser.close()
