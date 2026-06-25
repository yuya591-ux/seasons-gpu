import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4880
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 820, height: 460 } })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
// 開けた草地を探す: 周囲2mが非blockedで陸の点
const spot = await page.evaluate(() => {
  for (let tries=0; tries<400; tries++) {
    const x = -110 + Math.random()*200, z = -95 + Math.random()*120
    if (Math.abs(x)<5 && z<26 && z>-100) continue // 道
    const y = window.__town3dGroundAt(x,z); if (y < -9) continue // 海/谷底すぎ
    let ok=true; for (const [ox,oz] of [[0,0],[2,0],[-2,0],[0,2],[0,-2],[1.5,1.5]]) { const p = window.__town3dProbe(x+ox,z+oz); if (p.blocked) {ok=false;break} }
    if (ok) return {x:+x.toFixed(1), z:+z.toFixed(1), y:+y.toFixed(2)}
  }
  return null
})
console.log('spot', JSON.stringify(spot))
if (spot) {
  // 低く grazing（草株が手前に見える）
  save('tuft_low', await page.evaluate(([x,y,z]) => window.__town3dShotAt(x, y+1.0, z+4.5, x, y+0.25, z-6, 60), [spot.x, spot.y, spot.z]))
  // 真上から少し（地被の散らばり）
  save('tuft_top', await page.evaluate(([x,y,z]) => window.__town3dShotAt(x, y+5, z+3, x, y, z-3, 55), [spot.x, spot.y, spot.z]))
}
await browser.close()
