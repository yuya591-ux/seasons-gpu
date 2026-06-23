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
const y = await p.evaluate(()=>window.__town3dHeights(146,-648).heightAt + 2.4)
await p.evaluate(([y])=>window.__town3dFlyPose(146,y,-648,-0.5,0.0),[y]); await p.waitForTimeout(800)
const pts=[[0.4,0.86],[0.5,0.78],[0.3,0.62],[0.6,0.7],[0.15,0.7],[0.45,0.92]]
const out = await p.evaluate((pts)=>pts.map(([u,v])=>({uv:[u,v],hit:(window.__town3dPick(u,v)||[]).slice(0,3)})), pts)
console.log('cam y=',y.toFixed(1))
console.log(JSON.stringify(out,null,0))
console.log('waterscan:', JSON.stringify(await p.evaluate(()=>window.__town3dWaterScan(146,-648,40,3))))
await b.close()
