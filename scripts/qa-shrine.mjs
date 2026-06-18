// 鎮守の森の神社（ランドマーク）の確認。上空と接近から鳥居・社・森が見えるか。
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
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(1200)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.addStyleTag({ content: '.ui{display:none !important}' })

// 上空から神社を俯瞰（神社は -32,-18）
await page.evaluate(() => window.__town3dFlyPose(-32, 26, 4, 0.55, -0.5))
await page.waitForTimeout(500)
await page.screenshot({ path: 'scripts/_shots/shrine-0-above.png' })

// 鳥居の正面から接近（参道は街中心側＝鳥居の手前から見上げる）
await page.evaluate(() => window.__town3dFlyPose(-13, 8, -3, -0.96, -0.18))
await page.waitForTimeout(500)
await page.screenshot({ path: 'scripts/_shots/shrine-1-approach.png' })

await browser.close()
console.log('shrine shots done')
