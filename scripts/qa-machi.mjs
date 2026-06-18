// 商店街ゲート・提灯・駅の確認。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(1200)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.evaluate(() => window.__town3dCruise(false))
await page.addStyleTag({ content: '.ui{display:none !important}' })

// 商店街ゲートを道の上から（gz=-12）
await page.evaluate(() => window.__town3dFlyPose(0, 9, 4, 0, -0.28))
await page.waitForTimeout(500)
await page.screenshot({ path: 'scripts/_shots/machi-0-gate.png' })

// 駅(34,-44)のホーム・線路側から
await page.evaluate(() => window.__town3dFlyPose(34, 7, -56, 3.14, -0.08))
await page.waitForTimeout(500)
await page.screenshot({ path: 'scripts/_shots/machi-1-station.png' })

await browser.close()
console.log('machi shots done')
