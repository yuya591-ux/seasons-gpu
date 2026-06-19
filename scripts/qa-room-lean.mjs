// 3D室内窓枠の退場確認: 乗り出すと枠が退いて街へ／空を飛ぶと枠は消える（めり込み無し）。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2300)
await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(500)
await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(1700) // 乗り出す（枠が退く）
await page.screenshot({ path: 'scripts/_shots/room-leanout.png' })
await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(500)
await page.evaluate(() => { window.__town3dCruise(false); window.__town3dFlyPose(10, 34, 26, -0.3, -0.2) })
await page.waitForTimeout(900)
await page.screenshot({ path: 'scripts/_shots/room-fly.png' })
console.log('lean/fly shots done')
await browser.close()
