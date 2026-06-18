// ランドマークの賑わい（人の集い）の確認。駅前／商店街ゲート／川辺／公園に人がいるか。
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

// 駅前の広場（人だかり）。crowd≈(34,-35.5)を斜め上から
await page.evaluate(() => window.__town3dFlyPose(41, 12, -27, -0.68, -0.42))
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/crowd-0-station.png' })

// 商店街ゲート下の人。crowd≈(0,-14)
await page.evaluate(() => window.__town3dFlyPose(0, 4.5, -6, 0, -0.16))
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/crowd-1-gate.png' })

// 公園の池のほとりの人。crowd≈(14,-19)を斜め上から
await page.evaluate(() => window.__town3dFlyPose(24, 12, -13, -1.0, -0.46))
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/crowd-2-park.png' })

// 川辺（東岸）の人。crowd≈(-45.5,-17)を岸沿いに北へ見通す
await page.evaluate(() => window.__town3dFlyPose(-45, 4, -28, 3.14, -0.1))
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/crowd-3-river.png' })

await browser.close()
console.log('crowd shots done')
