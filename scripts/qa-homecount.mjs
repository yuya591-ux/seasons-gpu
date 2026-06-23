import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage()
await p.goto('http://localhost:4801/seasons/?dev=1', { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset')); await p.waitForTimeout(2800)
// 商店街を真上から見て人の点があるか
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(()=>window.__town3dFlyPose(0,55,-45,0,-1.2)); await p.waitForTimeout(900)
await p.screenshot({ path:'scripts/_shots/homepeep-top.png', clip:{x:300,y:150,width:600,height:500} })
await b.close()
