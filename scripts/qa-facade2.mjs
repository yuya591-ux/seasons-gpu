// 目線の高さで建物の壁に正対し、窓が「窓」として読めるか（歩行時の最も厳しい近接）。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(1800)
await page.addStyleTag({ content: '.ui{display:none !important}' })
await page.evaluate(() => window.__town3dFlyToggle(true))
await page.waitForTimeout(600)
// いくつかの建物の壁へ目線の高さで正対（yを地表付近に）
const poses = [[6, 3.5, -18, 1.4, 0.18], [-7, 3.0, -24, -1.3, 0.2], [3, 4.0, -33, 0.2, 0.25]]
for (let i = 0; i < poses.length; i++) {
  await page.evaluate((p) => window.__town3dFlyPose(...p), poses[i])
  await page.waitForTimeout(450)
  await page.screenshot({ path: `scripts/_shots/facade-eye-${i}.png` })
}
await browser.close()
console.log('eye-level facade shots done')
