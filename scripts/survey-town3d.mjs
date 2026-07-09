// town3dの全6情景を「利用者が実際に見る既定の眺め」で撮る（極端な見回しをせず、窓を開けて
// 既定の構図のまま）。商品化に向けた弱点を、実際の体験に即して洗い出すための survey。
import { chromium } from 'playwright'
const port = process.env.PORT || '4855'
const ids = [
  'kitaterao-window-3d', 'kitaterao-window-3d-spring', 'kitaterao-window-3d-autumn',
  'kitaterao-window-3d-snow', 'kitaterao-window-3d-night', 'shishigaya-window-3d',
  'shishigaya-window-3d-spring', 'shishigaya-window-3d-autumn', 'shishigaya-window-3d-snow',
]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`) })
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
for (const id of ids) {
  await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
  await page.waitForTimeout(2600) // 窓開けアニメ＋背景ロードの落ち着きを待つ
  await page.addStyleTag({ content: '.ui{display:none !important}' }).catch(() => {})
  await page.screenshot({ path: `scripts/_shots/survey-${id}.png` })
  console.log('survey', id)
}
console.log('errors =', errors.length)
for (const e of errors) console.log('  ', e)
await browser.close()
