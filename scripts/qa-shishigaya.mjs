import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4804
const id = process.argv[2] || 'shishigaya-morning-yato'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 880, height: 470 } })
const errs=[]; page.on('pageerror',e=>errs.push('PE:'+e.message))
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1500)
await page.evaluate((s) => window.__applyScene(s), id).catch(()=>{})
await page.waitForTimeout(3200)
const save = (name, durl) => { if(durl) writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64')) }
await page.screenshot({ path: `scripts/_shots/shi_${id}_window.png` })
const flyOk = await page.evaluate(()=>{ window.__town3dFly && window.__town3dFly(true); return !!(window.__town3dDbg && window.__town3dDbg()) })
await page.waitForTimeout(600)
if (flyOk) { await page.evaluate(()=>window.__town3dCruise(false)); await page.waitForTimeout(200)
  await page.evaluate(()=>window.__town3dFlyPose(0, 14, 26, 0, -0.22)); await page.waitForTimeout(2300)
  save(`shi_${id}_mid`, await page.evaluate(()=>window.__town3dShotAt(0, 12, 24, 0, 3, -16, 58)))
  const gy=await page.evaluate(()=>window.__town3dGroundAt(4,-6))
  save(`shi_${id}_grd`, await page.evaluate(([gy])=>window.__town3dShotAt(4, gy+1.7, 4, 4, gy+0.6, -12, 60),[gy]))
  console.log(id,'flyOk',flyOk,'gy',gy!=null?gy.toFixed(1):'null', errs.length?'ERR':'ok')
} else console.log(id,'flyOk false', errs.length?'ERR '+errs[0]:'')
await browser.close()
