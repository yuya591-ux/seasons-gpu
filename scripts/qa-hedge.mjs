// 道沿いの生垣を間近で見る＝葉のムラ材がベタ緑の板を脱したか確認（夏・春）。
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
  await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(900)
  await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(300)
  // 路肩の生垣(hx≈±4.1, z=0付近)を間近で見る：少し横・低めから生垣の面を見る
  await page.evaluate(() => { window.__town3dCruise(false); window.__town3dZoom(0.6); window.__town3dFlyPose(1.5, 3.2, -1, 1.4, -0.06) })
  await page.waitForTimeout(900)
  await page.screenshot({ path: `scripts/_shots/hedge-${label}.png` })
  console.log(label, 'done')
}
await shot('kitaterao-window-3d', 'summer')
await shot('kitaterao-window-3d-spring', 'spring')
await browser.close()
console.log('hedge done')
