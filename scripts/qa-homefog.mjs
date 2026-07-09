import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(()=>window.__town3dCruise(false))
// home上空をやや高所から俯瞰（実機の画像に近い）
await p.evaluate(()=>window.__town3dFlyPose(0,42,30,0,-0.28)); await p.waitForTimeout(1000)
await p.screenshot({ path:'scripts/_shots/home-fog-after.png' })
console.log('fog:', JSON.stringify(await p.evaluate(()=>({near:+scene?.fog?.near?.toFixed?.(0)})).catch(()=>'n/a')))
await b.close()
