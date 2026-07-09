import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4895
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 760, height: 520 } })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
// 公園～中心の低い俯瞰で動物を探す（r12-38に散在）
const v=[['p1',16,-26],['p2',-18,-12],['p3',20,-8],['p4',-8,-30]]
for (const [n,x,z] of v){ const gy=await page.evaluate(([x,z])=>window.__town3dGroundAt(x,z),[x,z]); save(`an_${n}`, await page.evaluate(([x,gy,z])=>window.__town3dShotAt(x,gy+4,z+10,x,gy+0.6,z-8,55),[x,gy,z])); console.log(n) }
await browser.close()
