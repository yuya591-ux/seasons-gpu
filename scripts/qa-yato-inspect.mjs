// 谷戸の真価＝谷筋フライと茅葺屋敷の作り込みを点検。実フロー(窓→乗り出し→空)で枠を消す。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })
await page.evaluate(() => window.__applyScene('shishigaya-window-3d'))
await page.waitForTimeout(2300)
await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(400)
await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(1000)
await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(300)

async function shot(label, pose, zoom = 1.1) {
  await page.evaluate((args) => { window.__town3dCruise(false); window.__town3dZoom(args.z); window.__town3dFlyPose(args.p[0], args.p[1], args.p[2], args.p[3], args.p[4]) }, { p: pose, z: zoom })
  await page.waitForTimeout(900)
  await page.screenshot({ path: `scripts/_shots/yato-${label}.png` })
  console.log(label, 'done')
}
// 谷を見下ろし（棚田が段々に積み上がる）／屋敷へ寄る／低く谷筋を見通す
await shot('valley', [0, 26, 22, 0, -0.5], 1.3)
await shot('house', [0, 11, -6, 0, -0.12], 0.8)
await shot('low', [0, 9, 10, 0, -0.18], 1.0)
await browser.close()
console.log('yato inspect done')
