import { chromium } from 'playwright'
import fs from 'node:fs'
// town3d以外のシェーダー系シーンを全数スクショ点検（縦窓＝スマホ縦）。出力をdiskに保存して目視評価する。
const PORT = process.env.PORT || 4899
const OUT = process.env.OUT || 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
fs.mkdirSync(OUT, { recursive: true })
const IDS = [
  'summer-rain-dusk', 'summer-rain-morning', 'summer-rain-night', 'autumn-rain-dusk',
  'summer-dusk-downtown', 'winter-snow-night-downtown', 'summer-rain-night-downtown',
  'summer-clear-noon', 'summer-morning-mountains', 'summer-dusk-seaside',
  'shishigaya-morning-yato',
  'kitaterao-rooftop', 'kitaterao-rooftop-night',
  'photo-window-town', 'photo-window-dusk', 'photo-window-night', 'photo-window-sea',
  'photo-window-spring', 'photo-window-autumn', 'photo-window-winter', 'photo-window-snow-night',
]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 460, height: 880 }, deviceScaleFactor: 1.5 })
const errs = []
page.on('pageerror', (e) => errs.push('PE:' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 120)) })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1500)
for (const id of IDS) {
  const before = errs.length
  await page.evaluate((s) => window.__applyScene(s), id).catch(() => {})
  await page.waitForTimeout(2600)
  await page.screenshot({ path: `${OUT}\\${id}.png` })
  const newErr = errs.slice(before)
  console.log(id, newErr.length ? 'ERR ' + JSON.stringify(newErr.slice(0, 2)) : 'ok')
}
console.log('--- 保存先', OUT)
await browser.close()
