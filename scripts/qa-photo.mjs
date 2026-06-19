// 実写の窓(photoWindow)シーンを点検＝写真主役の窓辺の質感。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
for (const id of ['photo-window-town', 'photo-window-sea', 'photo-window-autumn']) {
  await page.evaluate((s) => window.__applyScene(s), id)
  await page.waitForTimeout(2400)
  await page.addStyleTag({ content: '.ui{display:none !important}' }).catch(() => {})
  await page.screenshot({ path: `scripts/_shots/${id}.png` })
  console.log(id, 'done')
}
await browser.close()
console.log('photo done')
