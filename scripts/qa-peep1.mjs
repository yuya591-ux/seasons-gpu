import { chromium } from 'playwright'
const PORT = process.env.PORT || 4876
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 } })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(800)
await page.evaluate(() => window.__applyScene && window.__applyScene('summer-dusk-downtown')).catch(() => {})
await page.waitForTimeout(2600)
const info = await page.evaluate(() => {
  const blocked = window.__town3dProbe
  // peepsはフックから直接見えないので、シーン走査でなくResClipのbad＋近傍探索
  const r = window.__town3dResClip()
  return r.bad
})
console.log('bad:', JSON.stringify(info))
// その座標のコライダー詳細
const pr = await page.evaluate(() => window.__town3dProbe(34, -35.5))
console.log('probe(34,-35.5):', JSON.stringify(pr))
// festival稼働状況
const pal = await page.evaluate(() => window.__town3dPalProbe())
console.log('時間帯:', JSON.stringify(pal))
await browser.close()
