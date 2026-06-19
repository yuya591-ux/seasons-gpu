// 春・秋の飛行巡航と秋の谷戸（稲架掛け・刈田）を点検＝季節の作り込みの抜けを探す。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })

async function flyShot(scene, label, pose, zoom = 1.3) {
  await page.evaluate((s) => window.__applyScene(s), scene)
  await page.waitForTimeout(2300)
  await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(400)
  await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(1000)
  await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(300)
  await page.evaluate((args) => { window.__town3dCruise(false); window.__town3dZoom(args.z); window.__town3dFlyPose(args.p[0], args.p[1], args.p[2], args.p[3], args.p[4]) }, { p: pose, z: zoom })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `scripts/_shots/sf-${label}.png` })
  console.log(label, 'done')
}
await flyShot('kitaterao-window-3d-spring', 'spring-cruise', [18, 34, 30, -0.5, -0.28])
await flyShot('kitaterao-window-3d-autumn', 'autumn-cruise', [18, 34, 30, -0.5, -0.28])
await flyShot('shishigaya-window-3d-autumn', 'yato-autumn', [0, 13, 0, 0, -0.2], 1.0)
await browser.close()
console.log('season fly done')
