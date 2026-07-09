// 実写の窓（photoWindow）4情景を実機相当(DPR2・縦)で撮り、画質を点検する。引数: 出力接尾辞（before/after等）
import { chromium } from 'playwright'
const port = process.env.PORT || '4802'
const suffix = process.argv[2] || 'before'
const ids = ['photo-window-town', 'photo-window-dusk', 'photo-window-sea', 'photo-window-night']
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
for (const id of ids) {
  await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
  await page.waitForTimeout(1700)
  await page.addStyleTag({ content: '.ui{display:none !important}' })
  await page.waitForTimeout(150)
  await page.screenshot({ path: `scripts/_shots/pw-${id.replace('photo-window-', '')}-${suffix}.png` })
  console.log('shot', id, suffix)
}
await browser.close()
