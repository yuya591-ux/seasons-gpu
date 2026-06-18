// 夜の光の粒（蛍/塵）の確認。夜の立体の街を飛んで、空気に光の粒が舞うか。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const id = process.argv[2] || 'kitaterao-window-3d-night'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(1300)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.addStyleTag({ content: '.ui{display:none !important}' })

// 街の中ほどの高さで漂う光の粒を見る
await page.evaluate(() => window.__town3dFlyPose(0, 18, 0, 0, -0.15))
await page.waitForTimeout(700)
const vis = await page.evaluate(() => { const m = window.__town3dDbg(); return m })
console.log('夜飛行:', JSON.stringify(vis))
await page.screenshot({ path: 'scripts/_shots/motes-0-night.png' })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/motes-1-night.png' })
await browser.close()
console.log('motes shots done')
