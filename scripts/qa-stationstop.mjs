// 駅の停車とホームの人の確認。電車が来るのを待って連続撮影。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('ERR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(900)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1100)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(300)
await page.evaluate(() => { window.__town3dCruise(false); window.__town3dZoom(1.1); window.__town3dFlyPose(34, 19, -49, 0, -1.2) })
for (let i = 0; i < 9; i++) { await page.waitForTimeout(1400); await page.screenshot({ path: `scripts/_shots/station-stop${i}.png` }) }
await browser.close()
console.log('stationstop done')
