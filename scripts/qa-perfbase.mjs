import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:440,height:840} })
await p.goto('http://localhost:4920/seasons/?dev=1',{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
const hooks = await p.evaluate(()=>Object.keys(window).filter(k=>k.startsWith('__town3d')))
console.log('hooks:', hooks.join(','))
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
const snap = async (tag)=>{ const s = await p.evaluate(()=>{ const r=window.__renderer; const info = r&&r.info&&r.info.render; return { calls: info?info.calls:null, tris: info?info.triangles:null, stats: window.__town3dStats?window.__town3dStats():null } }); console.log(tag, JSON.stringify(s)) }
await snap('窓辺')
await p.evaluate(()=>window.__town3dFlyPose(0,28,40,Math.PI,-0.15)).catch(()=>{}); await p.waitForTimeout(2200); await snap('低空home')
await p.evaluate(()=>window.__town3dFlyPose(140,30,-560,Math.PI,-0.15)).catch(()=>{}); await p.waitForTimeout(2200); await snap('戦国低空')
await p.evaluate(()=>window.__town3dFlyPose(-20,120,-250,Math.PI,-0.2)).catch(()=>{}); await p.waitForTimeout(2200); await snap('雲海')
await b.close()
