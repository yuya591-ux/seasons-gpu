import { chromium } from 'playwright'
const port = process.env.PORT || '5121'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 760, height: 440 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui,[class*="toast"],[class*="hint"],[class*="cruise"]{display:none !important}' })
async function fly(scene) {
  await page.evaluate((s) => window.__applyScene(s), scene); await page.waitForTimeout(2600)
  await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(400)
  await page.evaluate(() => { window.__town3dCruise && window.__town3dCruise(false); window.__town3dZoom && window.__town3dZoom(1.0) }); await page.waitForTimeout(200)
}
async function shots(label, poses) {
  for (let i = 0; i < poses.length; i++) { await page.evaluate((p) => window.__town3dFlyPose(p[0], p[1], p[2], p[3], p[4]), poses[i]); await page.waitForTimeout(1100); await page.mouse.move(380, 220); await page.mouse.move(382, 222); await page.waitForTimeout(200); await page.screenshot({ path: `scripts/_shots/sg2-${label}-${i}.png` }) }
  console.log(label, 'done')
}
await fly('kitaterao-window-3d-rain-night')
await shots('shaft', [[-30, 134, -205, 0, 0.05], [-30, 150, -180, 0, -0.12], [10, 130, -250, -0.3, 0.04]])
await fly('kitaterao-window-3d')
await shots('gull', [[96, 16, -42, -1.57, 0], [88, 24, -30, 1.6, -0.25], [100, 18, -50, -1.9, 0]])
await browser.close()
console.log('check done')
