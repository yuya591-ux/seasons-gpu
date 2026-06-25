import { chromium } from 'playwright'
import fs from 'node:fs'
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:520,height:460}, deviceScaleFactor:1.8 })
const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,80))})
await p.goto('http://localhost:4920/seasons/?dev=1',{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFlyPose(-30,6,-10,Math.PI,-0.02)).catch(()=>{}); await p.waitForTimeout(2000)
// 低空で花畑の上を見回し、蝶を探す（生WebGLでmode=flyなので可視）
let saved=0
for(const [cx,cz,lx,lz] of [[-30,-12,-30,-40],[6,-46,6,-70],[-40,-30,-40,-55]]){
  const u=await p.evaluate(a=>window.__town3dShotAt(...a),[cx,5,cz,lx,3,lz,60])
  if(u&&u.startsWith('data:image')){ fs.writeFileSync('C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots\\bflyv-'+saved+'.png', Buffer.from(u.split(',')[1],'base64')); saved++ }
}
console.log('saved',saved, errs.length?'ERR'+JSON.stringify(errs.slice(0,3)):'no err')
await b.close()
