import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4803
const era = process.argv[2]
const C = { edo:[640,-46], sengoku:[140,-640], taisho:[-640,-30] }[era]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 820, height: 480 } })
const errs=[]; page.on('pageerror',e=>errs.push(e.message))
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1500)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(()=>{})
await page.waitForTimeout(3000)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
const [cx,cz]=C
await page.evaluate(([cx,cz])=>window.__town3dFlyPose(cx, 32, cz+22, 0, -0.2),[cx,cz]); await page.waitForTimeout(2600)
const save = (name, durl) => { if(durl) writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64')) }
save(`erag_${era}_mid`, await page.evaluate(([cx,cz])=>window.__town3dShotAt(cx, 18, cz+26, cx, 4, cz-10, 56),[cx,cz]))
const ox=C[0]+(era==='sengoku'?0:30), oz=C[1]+(era==='sengoku'?28:18)
const gy=await page.evaluate(([x,z])=>window.__town3dGroundAt(x,z),[ox,oz])
save(`erag_${era}_grd`, await page.evaluate(([x,gy,z])=>window.__town3dShotAt(x, gy+1.7, z+7, x, gy+0.5, z-12, 60),[ox,gy,oz]))
console.log(era,'gy',gy!=null?gy.toFixed(1):'null', errs.length?'ERR '+errs[0]:'ok')
await browser.close()
