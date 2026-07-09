// 着地の砂ぼこり＋沈み込みの確認。空から着地して、接地直後に砂ぼこりが立つか。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(1300)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.addStyleTag({ content: '.ui{display:none !important}' })

// 手前の開けた道の上空から着地（接地の砂ぼこりが地面に見える場所）
await page.evaluate(() => window.__town3dFlyPose(0, 22, 6, 0, -0.25))
await page.waitForTimeout(300)
await page.evaluate(() => window.__town3dLand(true))
// 着地のイージングで接地(約1.1s)→砂ぼこりが立つ。接地直後を撮る。
await page.waitForTimeout(1150)
await page.screenshot({ path: 'scripts/_shots/land-0-touchdown.png' })
await page.waitForTimeout(350)
await page.screenshot({ path: 'scripts/_shots/land-1-after.png' })
const d = await page.evaluate(() => window.__town3dDbg())
console.log('着地後:', JSON.stringify(d))
await browser.close()
console.log('land shots done')
