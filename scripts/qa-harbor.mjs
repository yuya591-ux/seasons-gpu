// 臨海の港の確認。倉庫・煙突・クレーン・ガスタンク・コンテナが海辺に並ぶか。
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

// 港の全景を海側・斜め上から（HARBOR 74,-64）
await page.evaluate(() => { window.__town3dZoom(1.2); window.__town3dFlyPose(88, 16, -64, -1.4, -0.42) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/harbor-0-far.png' })

// 港を真上ぎみから（船・クレーン・コンテナ・煙突・タンク・倉庫・舗装の配置）
await page.evaluate(() => { window.__town3dZoom(1.1); window.__town3dFlyPose(74, 34, -60, 0, -1.4) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/harbor-1-in.png' })

await browser.close()
console.log('harbor shots done')
