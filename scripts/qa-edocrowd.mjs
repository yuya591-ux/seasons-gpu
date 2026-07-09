import { chromium } from 'playwright'
import fs from 'node:fs'
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:520,height:460}, deviceScaleFactor:2 })
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,90))})
await p.goto('http://localhost:4920/seasons-gpu/?dev=1',{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFlyPose(614,12,-10,Math.PI,-0.1)).catch(()=>{}); await p.waitForTimeout(1800)
const gy=await p.evaluate(()=>window.__town3dGroundAt(614,-28)).catch(()=>5)
// 江戸の市の人々を間近で（生WebGLで造形確認）
for(const [n,cam] of Object.entries({
  market:[614,(gy||5)+1.6,-18, 614,(gy||5)+1.3,-30, 40],
  street:[620,(gy||5)+1.6,-40, 600,(gy||5)+1.3,-50, 42],
})){ const u=await p.evaluate(a=>window.__town3dShotAt(...a),cam); if(u&&u.startsWith('data:image')) fs.writeFileSync('C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots\\edocrowd-'+n+'.png', Buffer.from(u.split(',')[1],'base64')) }
console.log('gy='+gy, errs.length?'ERR'+JSON.stringify(errs.slice(0,3)):'no err')
await b.close()
