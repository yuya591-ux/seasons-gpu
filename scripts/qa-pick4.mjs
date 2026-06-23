import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1100, height: 620 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(()=>window.__town3dCruise(false))
await p.evaluate(()=>window.__town3dFlyPose(164,6,-646,0.4,0)); await p.waitForTimeout(800)
const pts=[[0.45,0.72],[0.3,0.66],[0.55,0.62],[0.2,0.78],[0.6,0.8],[0.4,0.55]]
const out = await p.evaluate((pts)=>pts.map(([u,v])=>({uv:[u,v],hit:window.__town3dPick(u,v)})), pts)
console.log(JSON.stringify(out,null,1))
// 谷底の高さを数点サンプル
const heights = await p.evaluate(()=>{
  const r=[]; for(const [x,z] of [[140,-640],[150,-642],[164,-646],[130,-635],[155,-648]]){ r.push({x,z}) }
  return r
})
console.log('SEA?',await p.evaluate(()=>window.__town3dPalProbe&&window.__town3dPalProbe()))
await b.close()
