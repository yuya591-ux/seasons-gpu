import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4803
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 820, height: 480 } })
const errs=[]; page.on('pageerror',e=>errs.push('PE:'+e.message)); page.on('console',m=>{if(m.type()==='error')errs.push('CE:'+m.text())})
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1500)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(()=>{})
await page.waitForTimeout(3000)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
// 戦国へ段階的に接近
await page.evaluate(()=>window.__town3dFlyPose(140, 60, -560, 0, -0.25)); await page.waitForTimeout(2500)
await page.evaluate(()=>window.__town3dFlyPose(140, 28, -600, 0, -0.18)); await page.waitForTimeout(2500)
const save = (name, durl) => { if(durl) writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64')); else console.log('null durl', name) }
const d1 = await page.evaluate(()=>{ try { return window.__town3dShotAt(140, 24, -596, 140, 6, -640, 56) } catch(e){ return 'ERR:'+e.message } })
if(typeof d1==='string' && d1.startsWith('ERR')) console.log(d1); else save('erag_sengoku_mid', d1)
const gy=await page.evaluate(()=>window.__town3dGroundAt(150,-625))
const d2 = await page.evaluate(([gy])=>{ try { return window.__town3dShotAt(150, gy+1.8, -618, 150, gy+0.6, -632, 60) } catch(e){ return 'ERR:'+e.message } },[gy])
if(typeof d2==='string' && d2.startsWith('ERR')) console.log(d2); else save('erag_sengoku_grd', d2)
console.log('sengoku gy', gy!=null?gy.toFixed(1):'null', 'errs', JSON.stringify(errs.slice(0,3)))
await browser.close()
