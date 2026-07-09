// 渡し舟を見下ろして確認（急角度）。ferry≈(56,88,-315)。
import { chromium } from 'playwright'
const port = process.env.PORT || '5121'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 680, height: 520 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui,[class*="toast"],[class*="hint"],[class*="cruise"]{display:none !important}' })
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')); await page.waitForTimeout(2400)
await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(250)
await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(600)
await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(250)
await page.evaluate(() => { window.__town3dCruise(false); window.__town3dZoom(1.0) })
async function shot(label, pose) {
  await page.evaluate((p) => window.__town3dFlyPose(p[0], p[1], p[2], p[3], p[4]), pose)
  await page.waitForTimeout(1400); await page.mouse.move(340, 260); await page.mouse.move(342, 262); await page.waitForTimeout(250)
  await page.screenshot({ path: `scripts/_shots/ferry3-${label}.png` }); console.log(label, 'done')
}
await shot('down', [56, 101, -301, 0, -0.6])      // 真上気味に見下ろす
await shot('down2', [64, 98, -308, -1.2, -0.5])   // 斜め上から
await browser.close()
console.log('check done')
