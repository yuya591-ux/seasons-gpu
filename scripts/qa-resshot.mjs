import { chromium } from 'playwright'
const PORT = process.env.PORT || 4876
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 820, height: 680 }, deviceScaleFactor: 1 })
const errs = []
page.on('pageerror', (e) => errs.push('PE:' + e.message))
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(700)
await page.evaluate(() => window.__town3dCruise(false)); await page.waitForTimeout(300)
const shots = [
  ['home_resspot', 0, 3.2, -16, 0.0, -0.34],
  ['home_station', 34, 3.4, -33, 0.0, -0.3],
  ['home_arcade',  3, 3.0, -6, 0.0, -0.42],
  ['sengoku_vil', 140, 13, -604, 0.0, -0.34],
  ['edo_town',   640, 12, -12, 0.0, -0.36],
  ['taisho_town', -640, 12, 2, 0.0, -0.36],
]
for (const [name, x, y, z, yaw, pitch] of shots) {
  await page.evaluate(([x, y, z, yaw, pitch]) => window.__town3dFlyPose(x, y, z, yaw, pitch), [x, y, z, yaw, pitch])
  await page.waitForTimeout(2600)
  await page.screenshot({ path: `scripts/_shots/res_${name}.png` })
  console.log('shot', name)
}
console.log(errs.length ? 'ERR ' + JSON.stringify(errs.slice(0,4)) : 'no errors')
await browser.close()
