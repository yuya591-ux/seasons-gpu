// スマホ横向き（landscape）の現状を各描画種で撮る。窓を閉じた額装の見え方＝枠の歪みを確認。
// 代表: cornerRoom / town3d / photoWindow / windowTown / windowSea / rainGlass。
import { chromium } from 'playwright'
const port = process.env.PORT || '4860'
const ids = [
  'autumn-dusk-corner-room', 'kitaterao-window-3d', 'photo-window-autumn',
  'summer-dusk-downtown', 'summer-dusk-seaside', 'autumn-rain-dusk',
]
const browser = await chromium.launch()
// 既定は横向きスマホ相当（iPhone 横 ≒ 844x390 / Android ≒ 915x412）。env で縦向きにも切替。
const VW = parseInt(process.env.VW || '900', 10), VH = parseInt(process.env.VH || '414', 10)
const tag = process.env.TAG || 'ls'
const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push('[c] ' + m.text()) })
page.on('pageerror', (e) => errors.push('[p] ' + e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
for (const id of ids) {
  await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
  await page.waitForTimeout(2400)
  await page.screenshot({ path: `scripts/_shots/${tag}-${id}.png` })
  console.log(tag, id)
}
console.log('errors =', errors.length)
for (const e of errors) console.log('  ', e)
await browser.close()
