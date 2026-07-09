// 棚田を真上ぎみに見下ろして「段で揃った棚田」に読めるか確認（夏・春）。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })
async function shot(scene, label) {
  await page.evaluate((s) => window.__applyScene(s), scene)
  await page.waitForTimeout(2300)
  await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(400)
  await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(1000)
  await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(300)
  await page.evaluate(() => { window.__town3dCruise(false); window.__town3dZoom(0.9); window.__town3dFlyPose(0, 18, -20, 0, -0.7) })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `scripts/_shots/paddy-${label}.png` })
  console.log(label, 'done')
}
await shot('shishigaya-window-3d', 'summer')
await shot('shishigaya-window-3d-spring', 'spring')
await browser.close()
console.log('paddy done')
