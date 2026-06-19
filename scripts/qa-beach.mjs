// 砂浜の海の家＋パラソル＋浮き輪＋賑わいの確認。
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

// 砂浜(海の家 71,-36)を海側・斜め上から
await page.evaluate(() => { window.__town3dZoom(1.0); window.__town3dFlyPose(84, 9, -36, -1.5, -0.26) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/beach-0.png' })

// 砂浜を内陸側から見おろす（海の家・パラソル・浮き輪・人）
await page.evaluate(() => { window.__town3dZoom(1.1); window.__town3dFlyPose(63, 14, -28, 0.86, -0.5) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/beach-1.png' })

await browser.close()
console.log('beach shots done')
