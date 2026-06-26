import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:440,height:800} })
const hits=[]; let cur=''
p.on('pageerror',e=>hits.push(`[${cur}] PE:${e.message}`))
p.on('console',m=>{ if(m.type()==='error'){const t=m.text(); if(!/Failed to load|favicon|404|net::ERR|コンパイルに失敗/.test(t)) hits.push(`[${cur}] CE:${t.slice(0,100)}`)}})
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
for(const s of ['kitaterao-window-3d-snow','kitaterao-window-3d-spring']){ cur=s
  await p.evaluate(x=>window.__applyScene(x),s).catch(e=>hits.push(`[${s}] throw ${e.message}`)); await p.waitForTimeout(2500)
  await p.evaluate(()=>window.__town3dFly&&window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(200)
  await p.evaluate(()=>window.__town3dFlyPose(-664,7,-13,Math.PI/2,-0.18)).catch(()=>{}); await p.waitForTimeout(700)
}
console.log(hits.length? hits.join('\n') : 'snow+spring avenue CLEAN')
await b.close()
