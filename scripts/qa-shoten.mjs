// 商店街の作り込み確認。店先・庇・暖簾・看板・灯る店窓・買い物客。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
async function setup(scene) {
  await page.evaluate((s) => window.__applyScene && window.__applyScene(s), scene)
  await page.waitForTimeout(2200)
  await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(900)
  await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1100)
  await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(300)
  await page.evaluate(() => window.__town3dCruise(false))
}
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.addStyleTag({ content: '.ui{display:none !important}' })

// 昼: 商店街の通りを上空から（中央道 x0、z-14..-38）
await setup('kitaterao-window-3d')
await page.evaluate(() => { window.__town3dZoom(1.0); window.__town3dFlyPose(0, 11, -2, 0, -0.5) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/shoten-0.png' })

// 通りに低く（店先・暖簾・庇）
await page.evaluate(() => { window.__town3dZoom(0.7); window.__town3dFlyPose(0, 4, -6, 0, -0.06) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/shoten-1.png' })

// 夜: 店窓の灯り
await setup('kitaterao-window-3d-night')
await page.evaluate(() => { window.__town3dZoom(0.8); window.__town3dFlyPose(0, 6, -8, 0, -0.16) })
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/shoten-2-night.png' })

await browser.close()
console.log('shoten shots done')
