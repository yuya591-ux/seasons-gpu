// 着地して歩く一人称視点＝接地レベルの造形・密度・整合を点検。複数シーン・複数地点。
// 実フロー通り 窓あけ→乗り出し（枠が消える）→空へ→着地、で撮る（枠の残りを避ける）。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })

async function walkShot(scene, label, pose) {
  await page.evaluate((s) => window.__applyScene(s), scene)
  await page.waitForTimeout(2300)
  await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(400)
  await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(900)
  await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(300)
  await page.evaluate((p) => { window.__town3dFlyPose(p[0], p[1], p[2], p[3], p[4]) }, pose)
  await page.waitForTimeout(400)
  await page.evaluate(() => { window.__town3dLand(true) }); await page.waitForTimeout(1800)
  const dbg = await page.evaluate(() => window.__town3dDbg && window.__town3dDbg())
  await page.screenshot({ path: `scripts/_shots/walk-${label}.png` })
  console.log(label, JSON.stringify(dbg))
}
await walkShot('kitaterao-window-3d', 'summer-road', [0, 7, -8, 3.14, -0.03])
await walkShot('kitaterao-window-3d-night', 'night-road', [0, 7, -8, 3.14, -0.03])
await walkShot('kitaterao-window-3d', 'summer-far', [0, 7, -30, 3.14, -0.03])
await browser.close()
console.log('walk done')
