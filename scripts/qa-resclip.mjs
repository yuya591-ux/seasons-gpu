import { chromium } from 'playwright'
// 住民が建物に食い込んでいないかを定量検証（実機FB ②）。?fest=1で全祭り会場を稼働＝最悪条件。
// __town3dResClip() = blockedAt 内にいる住民/peep の数。時間サンプリングで瞬間的なすり抜けも捕捉。
const PORT = process.env.PORT || 4876
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 1 })
const errs = []
page.on('pageerror', (e) => errs.push('PE:' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text()) })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1&fest=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(800)
await page.evaluate(() => window.__applyScene && window.__applyScene('summer-dusk-downtown')).catch(() => {})
await page.waitForTimeout(3000)
const has = await page.evaluate(() => typeof window.__town3dResClip === 'function')
if (!has) { console.log('NG: __town3dResClip 未定義'); console.log('errs', errs.slice(0, 5)); await browser.close(); process.exit(1) }
// homeで時間サンプリング（8回・約8秒）。歩行者がアーケード柱を避け切れているか
let maxRes = 0, maxPeep = 0; let lastBad = []
const base = await page.evaluate(() => window.__town3dResClip())
console.log('住民数:', base.residents, '/ peep数:', base.peeps)
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(1000)
  const r = await page.evaluate(() => window.__town3dResClip())
  maxRes = Math.max(maxRes, r.resIn); maxPeep = Math.max(maxPeep, r.peepIn)
  if (r.resIn + r.peepIn > 0) lastBad = r.bad
  console.log(`t+${i + 1}s 食い込み: 住民${r.resIn} / peep${r.peepIn}`)
}
console.log('--- home最大: 住民' + maxRes + ' / peep' + maxPeep + (lastBad.length ? ' / 例:' + JSON.stringify(lastBad) : ''))
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0, 6)) : 'コンソールエラー無し')
await browser.close()
