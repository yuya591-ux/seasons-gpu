// 電車の確認。線路を走る電車（駅付近）。2フレーム撮って移動を確認。
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
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(1000)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1300)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.evaluate(() => window.__town3dCruise(false))
await page.addStyleTag({ content: '.ui{display:none !important}' })

// 線路を真上ぎみから（rail z≈-51.4 を見おろし、電車を待つ）
await page.evaluate(() => { window.__town3dZoom(1.2); window.__town3dFlyPose(26, 26, -51, 0, -1.25) })
await page.waitForTimeout(900)
await page.screenshot({ path: 'scripts/_shots/train-0.png' })
await page.waitForTimeout(1500) // 電車が進む
await page.screenshot({ path: 'scripts/_shots/train-1.png' })

// 線路の脇から低く、線路に沿って（電車の側面）
await page.evaluate(() => { window.__town3dZoom(1.0); window.__town3dFlyPose(10, 5, -56, 1.3, 0.04) })
await page.waitForTimeout(1300)
await page.screenshot({ path: 'scripts/_shots/train-2-station.png' })

await browser.close()
console.log('train shots done')
