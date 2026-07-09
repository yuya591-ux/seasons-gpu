// 人物の接写（home街路の歩行者・住人）。何が人間離れして見えるか実像で確認。
import { chromium } from 'playwright'
const port = process.env.PORT || '5121'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 640, height: 560 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui,[class*="toast"],[class*="hint"],[class*="cruise"]{display:none !important}' })
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')); await page.waitForTimeout(2600)
await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(500)
await page.evaluate(() => { window.__town3dCruise && window.__town3dCruise(false) }); await page.waitForTimeout(200)
async function shot(label, pose) {
  await page.evaluate((p) => window.__town3dFlyPose(p[0], p[1], p[2], p[3], p[4]), pose)
  await page.waitForTimeout(1300); await page.mouse.move(330, 280); await page.mouse.move(332, 282); await page.waitForTimeout(250)
  await page.screenshot({ path: `scripts/_shots/ppl-${label}.png` }); console.log(label, 'done')
}
// home中央通り（歩行者x±2.4, z-84..12）。街路に立って人を見る
const gy = await page.evaluate(() => window.__town3dGroundAt ? window.__town3dGroundAt(0, -16) : 2)
console.log('gy', gy)
await shot('street', [3.5, gy + 1.6, -8, 3.4, -0.05])    // 通りの人を横から
await shot('street2', [-4, gy + 1.6, -22, 1.2, -0.04])    // 別角度
await shot('street3', [5, gy + 2.4, 2, 3.0, -0.22])       // 少し上から数人
await browser.close()
console.log('check done')
