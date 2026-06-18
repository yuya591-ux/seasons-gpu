// 広がった世界のスカイライン確認。高く昇って、観覧車・展望塔・五重塔・公園・学校・駅が
// 一望に並ぶか。退行確認も兼ねて窓辺の俯瞰も撮る。
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

// 高く昇って谷の奥を一望（観覧車・展望塔・五重塔が奥に並ぶ）
await page.evaluate(() => { window.__town3dZoom(1.4); window.__town3dFlyPose(0, 60, 0, 0, -0.42) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/skyline-0-high.png' })

// 右手から（学校・駅・公園・五重塔）
await page.evaluate(() => { window.__town3dZoom(1.2); window.__town3dFlyPose(60, 40, -20, -1.0, -0.4) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/skyline-1-right.png' })

await browser.close()
console.log('skyline shots done')
