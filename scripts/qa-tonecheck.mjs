// B3/B4の調査: 代表的な情景の窓辺/歩行ビューを撮り、近景トーン衝突・品質ムラの具体箇所を探す。
import { chromium } from 'playwright'
const port = process.env.PORT || '5080'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 760 }, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', (e) => errs.push('PE:' + e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(500)
await page.addStyleTag({ content: '.ui{display:none !important}' })
async function shot(scene, label) {
  await page.evaluate((s) => window.__applyScene(s), scene)
  await page.waitForTimeout(2800)
  await page.screenshot({ path: `scripts/_shots/tone-${label}.png` })
  console.log(label, 'done')
}
async function walkShot(scene, label) {
  await page.evaluate((s) => window.__applyScene(s), scene)
  await page.waitForTimeout(2600)
  await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(250)
  await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(500)
  await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(300)
  await page.evaluate(() => { window.__town3dLand(true) }); await page.waitForTimeout(1800) // 着地して歩く
  await page.screenshot({ path: `scripts/_shots/tone-${label}.png` })
  console.log(label, 'done')
}
await shot('kitaterao-window-3d', 'flagship-win')      // 旗艦の窓辺（夏夕方）
await shot('kitaterao-window-3d-night', 'home-night')   // 夜の窓辺
await walkShot('kitaterao-window-3d', 'home-walk')      // 歩行目線（近景トーン）
console.log('errs:', errs.length ? JSON.stringify(errs.slice(0, 4)) : 'none')
await browser.close()
console.log('check done')
