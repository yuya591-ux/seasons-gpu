import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4896
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 820, height: 480 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(800)
await page.evaluate(() => { window.__town3dCruise(false) })
// 遠景の建物群を俯瞰（接地影の有無を確認）。home北側 x>60 付近を見下ろす
await page.evaluate(() => window.__town3dFlyPose(40, 40, 130, -0.2, -0.45)); await page.waitForTimeout(1200)
await page.addStyleTag({ content: '.ui,[class*="toast"],[class*="hint"],[class*="cruise"],[class*="modepill"],[class*="gauge"],[class*="stagedots"]{display:none !important}' })
await page.screenshot({ path: 'scripts/_shots/t6_aerial.png' })
console.log('frozen', await page.evaluate(()=>window.__town3dFrozen && window.__town3dFrozen()))
await browser.close()
