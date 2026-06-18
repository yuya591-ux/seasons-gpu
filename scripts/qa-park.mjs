// 公園・池・太鼓橋の確認。上空俯瞰／橋の正面／ほとりから。
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

// 公園を斜め上空から（PARK 16,-27）。池・橋・桜・広場の全景。
await page.evaluate(() => window.__town3dFlyPose(16, 34, -25, 0, -1.4))
await page.waitForTimeout(600)
await page.screenshot({ path: 'scripts/_shots/park-0-above.png' })

// 池のほとり・低空から太鼓橋を横から（水面の映り込みと橋の反り）
await page.evaluate(() => window.__town3dFlyPose(16, 5.5, -14, 0, -0.12))
await page.waitForTimeout(600)
await page.screenshot({ path: 'scripts/_shots/park-1-bridge.png' })

// 橋の正面（x方向に架かる橋を端から見通す）
await page.evaluate(() => window.__town3dFlyPose(28, 5, -27, -1.57, -0.06))
await page.waitForTimeout(600)
await page.screenshot({ path: 'scripts/_shots/park-2-front.png' })

await browser.close()
console.log('park shots done')
