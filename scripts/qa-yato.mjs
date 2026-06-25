import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4803
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 880, height: 470 } })
const errs=[]; page.on('pageerror',e=>errs.push('PE:'+e.message))
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1500)
await page.evaluate(() => window.__applyScene('spring-morning-yato')).catch(()=>{})
await page.waitForTimeout(3000)
const save = (name, durl) => { if(durl) writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64')) }
// 窓辺の既定ビュー
await page.screenshot({ path: 'scripts/_shots/yato_window.png' })
// 飛んで低空＋接写
const flyOk = await page.evaluate(()=>{ window.__town3dFly && window.__town3dFly(true); return !!(window.__town3dDbg && window.__town3dDbg()) })
await page.waitForTimeout(600)
if (flyOk) { await page.evaluate(()=>window.__town3dCruise(false))
  await page.evaluate(()=>window.__town3dFlyPose(0, 8, 18, 0, -0.16)); await page.waitForTimeout(2200)
  save('yato_low', await page.evaluate(()=>window.__town3dShotAt(0, 6, 16, 0, 1.5, -12, 60)))
  const gy=await page.evaluate(()=>window.__town3dGroundAt(6,-8))
  save('yato_grd', await page.evaluate(([gy])=>window.__town3dShotAt(6, gy+1.7, -2, 6, gy+0.6, -16, 60),[gy]))
}
console.log('yato flyOk', flyOk, errs.length?'ERR '+errs[0]:'ok')
await browser.close()
