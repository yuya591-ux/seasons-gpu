// 駅前ロータリー＋バス停＋走るバスの確認。
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

// 駅前(ロータリー 31,-36／駅 34,-44)を真上ぎみから
await page.evaluate(() => { window.__town3dZoom(1.1); window.__town3dFlyPose(32, 19, -38, 0, -1.15) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/busstop-0.png' })

// 中央の街道（バスを狙う）を上から
await page.evaluate(() => { window.__town3dZoom(1.2); window.__town3dFlyPose(0, 24, -30, 0, -0.9) })
for (let i = 0; i < 3; i++) { await page.waitForTimeout(1200); await page.screenshot({ path: `scripts/_shots/busstop-bus${i}.png` }) }

await browser.close()
console.log('busstop shots done')
