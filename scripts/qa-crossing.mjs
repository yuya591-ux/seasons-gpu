// 踏切の確認。電車が近づくと遮断機が下り警報灯が点滅、通過後に上がる。連続フレームで両状態を狙う。
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

// 踏切(6,-51.4)を真上ぎみから（遮断桿の上下が読める）
await page.evaluate(() => { window.__town3dZoom(0.8); window.__town3dFlyPose(6, 13, -50, 0, -1.35) })
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `scripts/_shots/crossing-${i}.png` })
}
await browser.close()
console.log('crossing shots done')
