// 今セッションで見た目を変えた情景だけサムネ再生成（gen-thumbs の対象限定版）。
import { chromium } from 'playwright'
const port = process.env.PORT || '4875'
const ids = [
  'summer-dusk-seaside', 'summer-clear-noon', 'summer-morning-mountains',
  'kitaterao-rooftop', 'kitaterao-rooftop-night',
  'kitaterao-window-3d', 'kitaterao-window-3d-night', 'kitaterao-window-3d-snow', 'kitaterao-window-3d-spring', 'kitaterao-window-3d-autumn',
  'shishigaya-window-3d', 'shishigaya-window-3d-autumn', 'shishigaya-window-3d-snow', 'shishigaya-window-3d-spring', 'shishigaya-morning-yato',
]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1 })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(400)
await page.addStyleTag({ content: '.ui{display:none !important}' })
const known = await page.evaluate(() => window.__sceneIds || [])
for (const id of ids) {
  if (!known.includes(id)) { console.log('未知のID(スキップ):', id); continue }
  await page.evaluate((sid) => window.__applyScene(sid), id)
  await page.waitForTimeout(3600)
  await page.screenshot({ path: `public/thumbs/${id}.jpg`, type: 'jpeg', quality: 82, clip: { x: 80, y: 55, width: 740, height: 490 } })
  console.log('撮影:', id)
}
console.log(errs.length ? 'エラー:' + JSON.stringify(errs.slice(0, 4)) : 'エラー無し')
await browser.close()
