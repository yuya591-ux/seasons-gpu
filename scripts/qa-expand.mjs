// 飛べる範囲の拡張の確認。奥・横へ延びた街区が、広げた飛行範囲の縁まで埋まっているか。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(1200)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.evaluate(() => window.__town3dCruise(false))
await page.addStyleTag({ content: '.ui{display:none !important}' })

// 高く昇って奥の街並みを俯瞰（拡張した縁まで埋まっているか）
await page.evaluate(() => window.__town3dFlyPose(0, 95, -20, 0, -0.62))
await page.waitForTimeout(600)
await page.screenshot({ path: 'scripts/_shots/expand-0-high.png' })

// 奥の縁近くから手前を見渡す（奥に未生成の余白が出ていないか）
await page.evaluate(() => window.__town3dFlyPose(0, 30, -105, 0, -0.05))
await page.waitForTimeout(600)
await page.screenshot({ path: 'scripts/_shots/expand-1-back.png' })

// 横の縁（x=+78）から街の幅を見る
await page.evaluate(() => window.__town3dFlyPose(76, 26, -40, -1.57, -0.1))
await page.waitForTimeout(600)
await page.screenshot({ path: 'scripts/_shots/expand-2-side.png' })

await browser.close()
console.log('expand shots done')
