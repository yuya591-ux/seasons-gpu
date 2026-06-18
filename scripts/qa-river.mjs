// 川と橋の確認。上空と低空から、川筋・水面（空の映り）・護岸・橋が見えるか。
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

// 川(x=-52)の上空から見下ろす
await page.evaluate(() => window.__town3dFlyPose(-52, 22, -20, 0, -0.55))
await page.waitForTimeout(500)
await page.screenshot({ path: 'scripts/_shots/river-0-above.png' })

// 川の上空から橋(z=-16)へ向けて見下ろす（水面と橋を見通す）
await page.evaluate(() => window.__town3dFlyPose(-52, 17, 8, 0, -0.5))
await page.waitForTimeout(500)
await page.screenshot({ path: 'scripts/_shots/river-1-bridge.png' })

await browser.close()
console.log('river shots done')
