import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4877
const tag = process.argv[2] || 'before'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 800, height: 460 } })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
// 開けた地面を eye高さ(地面+1.6)から grazing に見る。広い範囲が地面で埋まる構図。
const spots = [['s', 18, -52],['e', 40, -20],['w', -28, -36]]
for (const [n, x, z] of spots) {
  const gy = await page.evaluate(([x,z]) => window.__town3dGroundAt(x,z), [x,z])
  // カメラを (x, gy+1.6, z+10) から (x, gy+0.2, z-30) へ＝地面を広く見渡す
  const d = await page.evaluate(([x,z,gy]) => window.__town3dShotAt(x, gy+1.7, z+8, x, gy+0.4, z-22, 60), [x,z,gy])
  save(`grd2_${tag}_${n}`, d); console.log(n, 'gy', gy.toFixed(2))
}
await browser.close()
