import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 1 })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
await page.goto('http://localhost:4875/seasons-gpu/?dev=1', { waitUntil: 'networkidle' })
// 初回フラグを消し、初期情景をシェーダー情景に固定
await page.evaluate(() => {
  localStorage.removeItem('seasons_look_demo')
  const s = JSON.parse(localStorage.getItem('seasons.state.v1') || '{}')
  s.sceneId = 'summer-dusk-seaside'
  localStorage.setItem('seasons.state.v1', JSON.stringify(s))
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await page.locator('.gate').click().catch(() => {})
const px = async () => (await page.evaluate(() => window.__renderer.getPan().x))
await page.waitForTimeout(1600); const a = await px()
await page.waitForTimeout(1900); const b = await px()
await page.waitForTimeout(1900); const c = await px()
await page.waitForTimeout(1400); const d = await px()
console.log('panX 推移: +1.6s=', a.toFixed(2), ' +3.5s=', b.toFixed(2), ' +5.4s=', c.toFixed(2), ' +6.8s=', d.toFixed(2))
console.log('右を覗いた(a>0.3):', a > 0.3, ' / 左へ振れた(b<a):', b < a, ' / 正面へ戻る(|d|<0.2):', Math.abs(d) < 0.2)
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0,4)) : 'エラー無し')
await browser.close()
