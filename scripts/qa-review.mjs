// 全シーン横断レビュー: 各季節・昼夜の窓辺(乗り出し)俯瞰を撮り、見た目の崩れ/弱点を点検。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })
const scenes = [
  ['kitaterao-window-3d', 'summer'], ['kitaterao-window-3d-spring', 'spring'],
  ['kitaterao-window-3d-autumn', 'autumn'], ['kitaterao-window-3d-snow', 'snow'],
  ['kitaterao-window-3d-night', 'night'], ['shishigaya-window-3d', 'yato'],
]
for (const [id, label] of scenes) {
  await page.evaluate((s) => window.__applyScene(s), id)
  await page.waitForTimeout(2400)
  await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(900)
  await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1200)
  await page.screenshot({ path: `scripts/_shots/review-${label}.png` })
  console.log('撮影', label)
}
await browser.close()
console.log('review done')
