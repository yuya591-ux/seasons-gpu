import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', e => console.log('ERR', e.message))
await page.goto('http://localhost:4801/seasons/?dev=1', { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(()=>{})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })
for (const [id,label] of [['kitaterao-window-3d','summer'],['kitaterao-window-3d-snow','winter'],['kitaterao-window-3d-autumn','autumn']]) {
  await page.evaluate(s=>window.__applyScene(s), id)
  await page.waitForTimeout(2400)
  await page.evaluate(()=>window.__town3dWindow(true)); await page.waitForTimeout(900)
  await page.evaluate(()=>window.__town3dLean(true)); await page.waitForTimeout(1100)
  await page.evaluate(()=>window.__town3dFly(true)); await page.waitForTimeout(300)
  await page.evaluate(()=>{ window.__town3dCruise(false); window.__town3dZoom(0.8); window.__town3dFlyPose(-12, 6, 12, 0, -0.12) })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `scripts/_shots/tree-${label}.png` })
}
await browser.close()
