// 室内（窓辺）と飛行で描画コール/三角形を比べ、室内の重さを測る。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
// 窓辺（室内あり）
let st = await page.evaluate(() => window.__town3dStats())
console.log('窓辺(室内あり):', JSON.stringify(st))
// 飛行（室内なし）
await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(400)
await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(900)
await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(600)
await page.evaluate(() => { window.__town3dFlyPose(10, 34, 26, -0.3, -0.2) }); await page.waitForTimeout(800)
st = await page.evaluate(() => window.__town3dStats())
console.log('飛行(室内なし):', JSON.stringify(st))
await browser.close()
