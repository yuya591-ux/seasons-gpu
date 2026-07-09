// 渡し舟を間近で確認（崩れ・棹・舟人）。ferry≈(56,88,-315)。トースト隠す。
import { chromium } from 'playwright'
const port = process.env.PORT || '5121'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 680, height: 480 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui,.toast,.hint,.modepill,[class*="toast"],[class*="hint"],[class*="cruise"]{display:none !important}' })
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')); await page.waitForTimeout(2400)
await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(250)
await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(600)
await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(250)
await page.evaluate(() => { window.__town3dCruise(false); window.__town3dZoom(1.0) })
async function shot(label, pose) {
  await page.evaluate((p) => window.__town3dFlyPose(p[0], p[1], p[2], p[3], p[4]), pose)
  await page.waitForTimeout(1400); await page.mouse.move(340, 240); await page.mouse.move(342, 242); await page.waitForTimeout(250)
  await page.screenshot({ path: `scripts/_shots/ferry2-${label}.png` }); console.log(label, 'done')
}
await shot('close', [56, 93, -306, 0, -0.16])    // 真横やや上から接近
await shot('close2', [62, 92, -312, -1.3, -0.1]) // 斜め前から
await browser.close()
console.log('check done')
