// 五重塔の寺の確認。遠望の全景／五重塔の全身／参道(山門・本堂)から。
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

// 寺(40,-74)の全景を斜め前から
await page.evaluate(() => window.__town3dFlyPose(40, 14, -56, 0, -0.22))
await page.waitForTimeout(600)
await page.screenshot({ path: 'scripts/_shots/temple-0-far.png' })

// 五重塔の全身に寄る（塔は本堂の左≈(34.5,-76)）
await page.evaluate(() => window.__town3dFlyPose(34, 12, -64, 0, -0.18))
await page.waitForTimeout(600)
await page.screenshot({ path: 'scripts/_shots/temple-1-pagoda.png' })

// 参道（山門→本堂）を見上げる
await page.evaluate(() => window.__town3dFlyPose(40, 5, -62, 0, -0.05))
await page.waitForTimeout(600)
await page.screenshot({ path: 'scripts/_shots/temple-2-approach.png' })

await browser.close()
console.log('temple shots done')
