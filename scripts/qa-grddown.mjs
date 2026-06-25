import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4878
const tag = process.argv[2] || 'after'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 700, height: 560 } })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
// 周縁の開けた地面を斜め見下ろし（建物が少なく地面のムラが見える）
const spots = [['periphery', -70, -80],['southfield', 0, -88],['eastslope', 60, -70]]
for (const [n, x, z] of spots) {
  const gy = await page.evaluate(([x,z]) => window.__town3dGroundAt(x,z), [x,z])
  save(`grdD_${tag}_${n}`, await page.evaluate(([x,z,gy]) => window.__town3dShotAt(x, gy+9, z+18, x, gy+0.5, z-12, 56), [x,z,gy]))
  console.log(n, 'gy', gy.toFixed(2))
}
await browser.close()
