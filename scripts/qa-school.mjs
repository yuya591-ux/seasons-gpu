// 学校の確認。校舎・校庭(トラック)・プール・桜・遊具の全景／校庭から校舎を見る。
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

// 学校(54,-18)の全景を斜め上から（校庭・トラック・プール・校舎）
await page.evaluate(() => window.__town3dFlyPose(54, 16, 0, 0, -0.5))
await page.waitForTimeout(600)
await page.screenshot({ path: 'scripts/_shots/school-0-above.png' })

// 校庭から校舎を見る（時計・窓・桜）。寄り気味にして三人称カメラを校庭上に保つ。
await page.evaluate(() => { window.__town3dZoom(0.45); window.__town3dFlyPose(54, 5, -13, 0, -0.04) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/school-1-yard.png' })

await browser.close()
console.log('school shots done')
