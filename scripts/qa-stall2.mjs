import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1000, height: 620 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(()=>window.__town3dCruise(false))
// 屋台(~146.7,-631)を街道側から正面に見る
await p.evaluate(()=>{const y=window.__town3dHeights(151,-631).heightAt+1.2; window.__town3dFlyPose(151,y,-631,-1.57,-0.04)}); await p.waitForTimeout(800)
await p.screenshot({ path:'scripts/_shots/stall-close.png' })
await b.close()
