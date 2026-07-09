import { chromium } from 'playwright'
import fs from 'node:fs'
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:480,height:440}, deviceScaleFactor:2 })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto('http://localhost:4920/seasons-gpu/?dev=1',{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFlyPose(0,10,0,Math.PI,-0.1)).catch(()=>{}); await p.waitForTimeout(1500)
const pos = await p.evaluate(()=>window.__bfPos ? window.__bfPos() : null)
console.log('butterfly positions:', JSON.stringify(pos))
if(pos && pos.length){ // 最初の2匹に寄って撮る
  for(let i=0;i<Math.min(2,pos.length);i++){ const [x,y,z]=pos[i]
    const u=await p.evaluate(a=>window.__town3dShotAt(...a),[x+2.2,y+0.5,z+2.2, x,y,z, 26])
    if(u&&u.startsWith('data:image')) fs.writeFileSync('C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots\\bfclose-'+i+'.png', Buffer.from(u.split(',')[1],'base64'))
  }
}
console.log(errs.length?'ERR'+JSON.stringify(errs.slice(0,3)):'no err')
await b.close()
