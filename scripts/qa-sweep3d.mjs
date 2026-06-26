import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:430,height:850}, deviceScaleFactor:2, isMobile:true, hasTouch:true })
let cur=''; const hits=[]
p.on('pageerror',e=>hits.push(`[${cur}] PE: ${e.message}`))
p.on('console',m=>{ if(m.type()==='error'){ const t=m.text(); if(!/Failed to load resource|favicon|404|net::ERR/.test(t)) hits.push(`[${cur}] CE: ${t.slice(0,140)}`) }})
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
const evs=['birds','balloon','star','contrail','cloudShade','duskLights','rainbow','mist','godRays','drift','fireworks','fireworksFinale','aurora','milkyway','rain','wetRoad']
async function exercise(scene, areas){
  cur=scene
  await p.evaluate(s=>window.__applyScene(s), scene).catch(e=>hits.push(`[${scene}] applyScene throw ${e.message}`)); await p.waitForTimeout(2600)
  await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(300)
  for(const [x,y,z] of areas){
    await p.evaluate(([x,y,z])=>window.__town3dFlyPose(x,y,z,Math.random()*6,-0.1),[x,y,z]).catch(()=>{}); await p.waitForTimeout(1400)
    // イベントを数発（その場で）
    for(const e of evs){ await p.evaluate(n=>window.__town3dEvent&&window.__town3dEvent(n), e).catch(()=>{}); await p.waitForTimeout(30) }
    await p.waitForTimeout(600)
    await p.evaluate(()=>window.__town3dLand && window.__town3dLand(true)).catch(()=>{}); await p.waitForTimeout(1600)
    // 歩行の左右スティックを少し動かす
    await p.evaluate(()=>{ const c=document.querySelector('canvas'); if(!c) return; const r=c.getBoundingClientRect(); const ev=(ty,x,y)=>c.dispatchEvent(new PointerEvent(ty,{pointerId:1,clientX:x,clientY:y,bubbles:true})); ev('pointerdown',r.left+60,r.bottom-90); ev('pointermove',r.left+90,r.bottom-120); }).catch(()=>{}); await p.waitForTimeout(900)
    await p.evaluate(()=>{ const c=document.querySelector('canvas'); if(c) c.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,bubbles:true})) }).catch(()=>{})
    await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
  }
}
// home: 中心/公園/海辺/江戸/戦国/大正/雲上
await exercise('kitaterao-window-3d', [[0,18,-20],[16,16,-27],[60,14,30],[640,18,-46],[140,20,-620],[-636,16,-30],[0,140,80]])
// 谷戸
await exercise('shishigaya-window-3d', [[-8,12,-8],[0,16,-30],[6,14,4]])
console.log('=== 3D exercise done ===')
console.log(hits.length? hits.join('\n') : 'NO ERRORS in 3D exercise')
await b.close()
