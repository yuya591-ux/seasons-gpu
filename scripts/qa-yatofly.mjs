// 谷戸（獅子ヶ谷）を飛べるかの確認。棚田の谷筋を流すように飛ぶ／里山の縁／低く棚田の上。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('shishigaya-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(1200)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
const dbg = await page.evaluate(() => window.__town3dDbg && window.__town3dDbg())
console.log('谷戸 dbg =', JSON.stringify(dbg))
await page.evaluate(() => window.__town3dCruise(false))
await page.addStyleTag({ content: '.ui{display:none !important}' })

// 谷筋を見おろす（棚田の段々・横溝屋敷・里山）
await page.evaluate(() => window.__town3dFlyPose(0, 22, 14, 0, -0.5))
await page.waitForTimeout(600)
await page.screenshot({ path: 'scripts/_shots/yatofly-0-valley.png' })

// 低く棚田の上を流す
await page.evaluate(() => window.__town3dFlyPose(2, 7, -6, 0, -0.08))
await page.waitForTimeout(600)
await page.screenshot({ path: 'scripts/_shots/yatofly-1-low.png' })

// 里山の縁から谷を横切って見る
await page.evaluate(() => window.__town3dFlyPose(17, 13, -18, -1.2, -0.12))
await page.waitForTimeout(600)
await page.screenshot({ path: 'scripts/_shots/yatofly-2-hill.png' })

await browser.close()
console.log('yatofly shots done')
