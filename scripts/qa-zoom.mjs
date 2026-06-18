// ズーム（ピンチ相当 __town3dZoom）の確認。寄り(0.4)・標準(1)・引き(3.0)でカメラ距離が変わるか。
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
await page.evaluate(() => { window.__town3dCruise(false); window.__town3dFlyPose(0, 24, -6, 0, -0.15) }) // ホバリングで街上空
await page.waitForTimeout(400)

for (const [z, name] of [[0.4, 'in'], [1, 'std'], [3.0, 'out']]) {
  await page.evaluate((zz) => window.__town3dZoom(zz), z)
  await page.waitForTimeout(900) // カメラが寄る/引くのを待つ
  await page.screenshot({ path: `scripts/_shots/zoom-${name}.png` })
  console.log('zoom', z, '撮影')
}
await browser.close()
console.log('zoom test done')
