// 描画統計(ドローコール/三角形)を江戸の街で確認＝面取りの性能影響を測る。
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
await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(700)
await page.evaluate(() => window.__town3dFlyPose(600, 60, -46, Math.PI / 2, -0.3)); await page.waitForTimeout(800) // 江戸(x640)
console.log('stats:', JSON.stringify(await page.evaluate(() => window.__town3dStats && window.__town3dStats())))
await browser.close()
