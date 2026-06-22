// 住民（群衆）の歩行アニメ検証: 歩道を地上目線で接写(オフスクリーン)。2フレームで脚/腕の位相が変わるか
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 700, height: 600 }, deviceScaleFactor: 1 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await p.waitForTimeout(2600)
const save = async (name) => {
  const url = await p.evaluate(() => window.__town3dShotAt(3, 1.3, -8, 2.6, 0.7, -42, 48)) // x=3の歩道を南へ見下ろす目線
  writeFileSync(`scripts/_shots/${name}`, Buffer.from(url.split(',')[1], 'base64'))
}
await save('walk-1.png')
await p.waitForTimeout(330)
await save('walk-2.png')
await p.waitForTimeout(330)
await save('walk-3.png')
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
