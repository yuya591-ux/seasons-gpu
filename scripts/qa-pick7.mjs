import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1100, height: 620 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(()=>window.__town3dCruise(false))
const y = await p.evaluate(()=>window.__town3dHeights(144,-650).heightAt + 2.0)
await p.evaluate(([y])=>window.__town3dFlyPose(144,y,-650,1.4,-0.25),[y]); await p.waitForTimeout(800)
// 家の足元の広い水と、家そのものを狙う
const pts=[[0.3,0.78],[0.45,0.72],[0.2,0.85],[0.5,0.6],[0.35,0.9],[0.6,0.75]]
const out = await p.evaluate((pts)=>pts.map(([u,v])=>({uv:[u,v],hit:(window.__town3dPick(u,v)||[]).slice(0,3)})), pts)
console.log('cam y',y.toFixed(1)); console.log(JSON.stringify(out))
// 海プレーンのYと、谷底の地形高を直接
console.log('terrain at valley floor pts:', JSON.stringify(await p.evaluate(()=>[[140,-648],[144,-650],[148,-652],[136,-646]].map(([x,z])=>({x,z,h:window.__town3dHeights(x,z).heightAt})))))
await b.close()
