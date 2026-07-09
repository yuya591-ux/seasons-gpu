// 縦→横の回転（resize）が破綻なく追従するか検証。town3d とシェーダー情景で、回転前後を撮影。
import { chromium } from 'playwright'
const port = process.env.PORT || '4860'
const errors = []
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('console', (m) => { if (m.type() === 'error') errors.push('[c] ' + m.text()) })
page.on('pageerror', (e) => errors.push('[p] ' + e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
for (const id of ['kitaterao-window-3d', 'autumn-dusk-corner-room', 'photo-window-autumn']) {
  await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
  await page.waitForTimeout(2200)
  await page.setViewportSize({ width: 900, height: 414 }) // 縦→横へ回転
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `scripts/_shots/rot-${id}.png` })
  await page.setViewportSize({ width: 440, height: 900 }) // 横→縦へ戻す
  await page.waitForTimeout(800)
  console.log('rotated', id)
}
console.log('errors =', errors.length)
for (const e of errors) console.log('  ', e)
await browser.close()
