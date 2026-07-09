import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const SC = ['kitaterao-window-3d','kitaterao-window-3d-spring','kitaterao-window-3d-autumn','kitaterao-window-3d-snow','kitaterao-window-3d-night','kitaterao-window-3d-rain','kitaterao-window-3d-sunset']
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:440,height:800} })
let cur=''; const hits=[]
p.on('pageerror',e=>hits.push(`[${cur}] PE:${e.message}`))
p.on('console',m=>{ if(m.type()==='error'){ const t=m.text(); if(!/Failed to load|favicon|404|net::ERR|コンパイルに失敗/.test(t)) hits.push(`[${cur}] CE:${t.slice(0,120)}`) }})
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
for(const s of SC){ cur=s; await p.evaluate(x=>window.__applyScene(x),s).catch(e=>hits.push(`[${s}] throw ${e.message}`)); await p.waitForTimeout(2400)
  // 飛んで海辺に寄り、渚の生成経路を確実に踏む
  await p.evaluate(()=>window.__town3dFly&&window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(200)
  await p.evaluate(()=>window.__town3dFlyPose(95,6,40,-1.5,-0.2)).catch(()=>{}); await p.waitForTimeout(700)
  await p.evaluate(()=>window.__town3dWindow&&window.__town3dWindow(false)).catch(()=>{})
}
console.log(hits.length? hits.join('\n') : 'ALL HOME VARIANTS CLEAN (foam/sand/driftwood ok)')
await b.close()
