// 没入要素の確認: 自分の影が地面を走る・高速時の風筋・低空での影の濃さ。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(1300)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.addStyleTag({ content: '.ui{display:none !important}' })

// 中央の道の上を低空で＝影がはっきり道を走る（木に隠れない開けた場所）
await page.evaluate(() => window.__town3dFlyPose(0, 7, 8, 0, -0.42))
await page.waitForTimeout(500)
await page.screenshot({ path: 'scripts/_shots/imm-0-shadow-low.png' })

// 高速前進＝風筋が出る（街を背景に見下ろし気味＝加算で筋が読める）
await page.evaluate(() => window.__town3dFlyPose(0, 16, 14, 0, -0.45))
await page.evaluate(() => window.__town3dMove(0, 1))
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/imm-1-streak.png' })
const d = await page.evaluate(() => window.__town3dDbg())
console.log('高速時:', JSON.stringify(d))

// 高所＝影は薄く広い
await page.evaluate(() => window.__town3dMove(0, 0))
await page.evaluate(() => window.__town3dFlyPose(0, 60, 6, 0, -0.7))
await page.waitForTimeout(500)
await page.screenshot({ path: 'scripts/_shots/imm-2-shadow-high.png' })

await browser.close()
console.log('immerse shots done')
