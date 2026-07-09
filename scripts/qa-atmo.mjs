// 大気オーバーレイの情景同調（--t3d-glow/shade/wash）の確認。昼/夕/夜/雪を撮る。
// dev起動(4875)中に実行。スマホ縦(440x900, DPR2)。
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://localhost:4875/seasons-gpu/?dev=1', { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })

async function scene(id, file, { lean = false, view = null } = {}) {
  await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
  await page.waitForTimeout(2600)
  if (view) await page.evaluate(([y, p]) => window.__town3dSetView && window.__town3dSetView(y, p), view)
  if (lean) { await page.evaluate(() => window.__town3dLean && window.__town3dLean(true)); await page.waitForTimeout(5200) }
  else await page.waitForTimeout(400)
  await page.screenshot({ path: `scripts/_shots/${file}.png` })
  console.log('撮影:', file)
}

await scene('kitaterao-window-3d', 'qa-noon-front')
await scene('kitaterao-window-3d', 'qa-noon-lean', { lean: true, view: [0, -0.7] })
await scene('summer-dusk-downtown', 'qa-dusk-front')
await scene('kitaterao-window-3d-night', 'qa-night-front')
await scene('kitaterao-window-3d-snow', 'qa-snow-front')

console.log(errors.length ? ('エラー: ' + JSON.stringify(errors.slice(0, 5))) : 'エラー無し')
await browser.close()
