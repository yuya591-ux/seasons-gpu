import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4878
const tag = process.argv[2] || 'after'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 440 } })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
// ロータリー/バス停(25,-37)付近の開けた地面を横長・eye高さで見渡す（横画面=実機landscape）
const views = [
  ['rotary', 31, -22, 31, -40],   // ロータリーを南から見る
  ['busstop', 20, -30, 28, -44],  // バス停越しに開けを見る
  ['eastopen', 45, -30, 55, -48], // 東の開け
]
for (const [n, cx, cz, lx, lz] of views) {
  const gy = await page.evaluate(([x,z]) => window.__town3dGroundAt(x,z), [cx,cz])
  const ly = await page.evaluate(([x,z]) => window.__town3dGroundAt(x,z), [lx,lz])
  save(`bus_${tag}_${n}`, await page.evaluate(([cx,cz,gy,lx,lz,ly]) => window.__town3dShotAt(cx, gy+1.65, cz, lx, ly+1.0, lz, 70), [cx,cz,gy,lx,lz,ly]))
  console.log(n, 'gy', gy.toFixed(2))
}
await browser.close()
