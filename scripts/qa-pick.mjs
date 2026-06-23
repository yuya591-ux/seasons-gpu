import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 2 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(()=>window.__town3dCruise(false))
await p.evaluate(()=>window.__town3dFlyPose(140,12,-636,0,0)); await p.waitForTimeout(900)
// グリッドでレイキャストし、明色(平均輝度>0.62)のヒットを集計
const found = await p.evaluate(()=>{
  const res=[]
  for(let vy=0; vy<=0.62; vy+=0.04){ for(let vx=0; vx<=1; vx+=0.03){
    const h=window.__town3dPick(vx,vy); if(!h||!h.length)continue; const t=h[0]
    const c=t.col; if(c&&c[0]==='#'){ const r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),bl=parseInt(c.slice(5,7),16); const lum=(r+g+bl)/765; if(lum>0.62){ res.push({vx:+vx.toFixed(2),vy:+vy.toFixed(2),...t,lum:+lum.toFixed(2)}) } }
  }}
  // 種類ごとに集計
  const agg={}; for(const x of res){ const k=x.type+'|'+x.col+'|'+x.par; agg[k]=(agg[k]||0)+1 }
  return { count:res.length, agg, sample:res.slice(0,16) }
})
console.log(JSON.stringify(found,null,1))
console.log(errs.length?'ERR '+errs.slice(0,3).join(' | '):'no errors')
await b.close()
