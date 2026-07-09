// 港の大橋（斜張橋）と小島の確認。湾を渡る橋・主塔・ケーブル・島。
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
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(1000)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1300)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.evaluate(() => window.__town3dCruise(false))
await page.addStyleTag({ content: '.ui{display:none !important}' })

// 橋の全景を横から（湾を渡る斜張橋＋島。BZ=-40、A=72..B=96）
await page.evaluate(() => { window.__town3dZoom(1.3); window.__town3dFlyPose(84, 12, -22, 0, -0.18) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/bridge-0-side.png' })

// 橋を斜め上から（主塔・ケーブル・桁・島）
await page.evaluate(() => { window.__town3dZoom(1.2); window.__town3dFlyPose(84, 22, -22, 0.2, -0.5) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/bridge-1-above.png' })

// 島から橋・街を見る
await page.evaluate(() => { window.__town3dZoom(1.0); window.__town3dFlyPose(102, 8, -40, -1.57, -0.05) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/bridge-2-island.png' })

await browser.close()
console.log('bridge shots done')
