// 毛柄(背〜脇腹の縞)の明瞭化を確認。複数回起動して縞が出る毛色を捉え、横・斜め後ろから撮る。
import { chromium } from 'playwright'
const port = process.env.PORT || '5121'
const browser = await chromium.launch()
for (let n = 0; n < 5; n++) {
  const page = await browser.newPage({ viewport: { width: 560, height: 600 }, deviceScaleFactor: 2 })
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
  await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
  await page.locator('.gate').click().catch(() => {})
  await page.waitForTimeout(400)
  await page.addStyleTag({ content: '.ui{display:none !important}' })
  await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
  await page.waitForTimeout(2600)
  const coat = await page.evaluate(() => window.__town3dCatState2 ? (window.__town3dCatState2().coat || '?') : '?')
  // 斜め後ろ上から＝背と脇腹の縞がよく見える
  await page.evaluate(() => window.__town3dSetView(0.5, -0.5)); await page.waitForTimeout(1000)
  await page.screenshot({ path: `scripts/_shots/catstripe-${n}.png` })
  console.log('shot', n, 'coat', coat)
  await page.close()
}
await browser.close()
console.log('check done')
