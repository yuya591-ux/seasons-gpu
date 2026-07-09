import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4885
const tag = process.argv[2] || 'before'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 720, height: 560 } })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
// apt建物を探して正面から撮る: __town3dMeshHistoは使えないので、住宅街の集合住宅を狙う
// 住宅街(-30..40, -40..-80)を上から俯瞰してapt位置を見つける用に数点を正面撮り
const tries = [[-20,-52],[28,-58],[-35,-44],[40,-50],[10,-62]]
for (let i=0;i<tries.length;i++){ const [x,z]=tries[i]; const gy=await page.evaluate(([x,z])=>window.__town3dGroundAt(x,z),[x,z])
  save(`apt_${tag}_${i}`, await page.evaluate(([x,gy,z])=>window.__town3dShotAt(x, gy+6, z+16, x, gy+5, z, 50),[x,gy,z])); console.log(i,'gy',gy.toFixed(1)) }
await browser.close()
