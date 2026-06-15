// 厳格評価用に主要情景を一式撮影して scripts/_shots/eval-<id>.png に保存する。
// プレビュー(4790, ?dev=1)起動中に実行。スマホ縦画角(440x900, DPR2)で実機に近い見え方。
import { chromium } from 'playwright'
const SCENES = [
  'autumn-dusk-corner-room', 'summer-rain-dusk', 'summer-dusk-downtown',
  'winter-snow-night-downtown', 'summer-rain-night-downtown', 'summer-morning-mountains',
  'summer-dusk-seaside', 'spring-dusk-corner-room', 'winter-snow-dusk-corner-room',
  'summer-morning-corner-room', 'autumn-rain-night-corner-room', 'kitaterao-rooftop',
  'shishigaya-morning-yato', 'kitaterao-window-3d', 'kitaterao-window-3d-night',
  'kitaterao-window-3d-snow', 'kitaterao-window-3d-spring',
]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://localhost:4790/seasons/?dev=1', { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })
for (const id of SCENES) {
  await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `scripts/_shots/eval-${id}.png` })
  console.log('撮影:', id)
}
console.log(errors.length ? ('エラー: ' + JSON.stringify(errors.slice(0, 5))) : 'エラー無し')
await browser.close()
