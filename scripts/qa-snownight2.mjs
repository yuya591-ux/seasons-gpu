// 雪の夜(kitaterao)の窓の見え方を高解像で確認。夜なのに上部が白飛びしていないか。雪夜↔夜↔雪昼を比較。
import { chromium } from 'playwright'
const port = process.env.PORT || '5121'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 460, height: 620 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })
for (const id of ['kitaterao-window-3d-snow-night', 'kitaterao-window-3d-night', 'kitaterao-window-3d-snow']) {
  await page.evaluate((i) => window.__applyScene(i), id)
  await page.waitForTimeout(700)
  await page.evaluate((i) => window.__applyScene(i), id)
  await page.waitForTimeout(2000)
  await page.mouse.move(230, 300); await page.mouse.move(232, 302)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `scripts/_shots/sn-${id}.png` })
  console.log('shot', id)
}
await browser.close()
console.log('snownight done')
