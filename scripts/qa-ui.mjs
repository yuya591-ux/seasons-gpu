// 飛行時の操作トレイ(左下集約)・情景名トースト・設定の音行を確認。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2400)
await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(400)
await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(500)
await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(900)
await page.evaluate(() => window.__town3dFlyPose(262, 30, -30, Math.PI / 2, -0.08)); await page.waitForTimeout(600)
await page.mouse.move(220, 450); await page.mouse.move(221, 451); await page.waitForTimeout(300)
await page.screenshot({ path: 'scripts/_shots/ui-fly.png' })
// 設定パネルを開いて音行を確認
await page.locator('.topbar .iconbtn', { hasText: '設定' }).click().catch(() => {})
await page.waitForTimeout(600)
await page.screenshot({ path: 'scripts/_shots/ui-settings.png' })
console.log('ui shots done')
await browser.close()
