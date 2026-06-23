import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1100, height: 620 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(()=>window.__town3dCruise(false))
const y = await p.evaluate(()=>window.__town3dHeights(150,-652).heightAt + 2.4)
await p.evaluate(([y])=>window.__town3dFlyPose(150,y,-652,0.4,0),[y]); await p.waitForTimeout(800)
const pts=[[0.3,0.92],[0.45,0.85],[0.2,0.8],[0.5,0.95],[0.35,0.7]]
const out = await p.evaluate((pts)=>pts.map(([u,v])=>({uv:[u,v],hit:(window.__town3dPick(u,v)||[]).slice(0,2)})), pts)
console.log('cam y',y.toFixed(1)); console.log(JSON.stringify(out))
await b.close()
