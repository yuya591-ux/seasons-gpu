// 道路上コライダー4件の見た目確認（中央通りの上の建物の疑い）
import { chromium } from 'playwright'
import fs from 'node:fs'
const port = process.env.PORT || '4890'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(900)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1200)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.evaluate(() => window.__town3dCruise(false))
await page.addStyleTag({ content: '.ui{display:none !important}' })
const save = (dataUrl, name) => { if (!dataUrl) { console.log('SHOT失敗:', name); return } fs.writeFileSync(`scripts/_shots/audit4-${name}.png`, Buffer.from(dataUrl.split(',')[1], 'base64')) }
for (const [x, z] of [[-2.7, -88.3], [0.9, -78.4], [1.4, -60.3], [1.6, -24.4]]) {
  await page.evaluate(([a, b]) => window.__town3dFlyPose(a, 30, b + 14, 0, 0), [x, z])
  await page.waitForTimeout(600)
  const gy = await page.evaluate(([a, b]) => window.__town3dGroundAt(a, b), [x, z])
  save(await page.evaluate(([a, b, g]) => window.__town3dShotAt(a, g + 14, b + 16, a, g + 1, b, 55), [x, z, gy]), `road-${x}_${z}`)
}
await browser.close()
console.log('qa-audit4 done')
