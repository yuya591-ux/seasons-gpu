import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 920, height: 600 }, deviceScaleFactor: 1.9 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
// 商店街の暖簾(昼)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')); await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(()=>window.__town3dFlyPose(4,3,-30,0.4,-0.02)); await p.waitForTimeout(1200)
await p.screenshot({ path:'scripts/_shots/fix2-noren.png' })
// 角部屋 左窓 vs ダンス
await p.evaluate(()=>window.__applyScene('summer-morning-corner-room')); await p.waitForTimeout(2700)
await p.evaluate(()=>{ for(let i=0;i<9;i++) window.__town3dLook(-26,0) }); await p.waitForTimeout(800)
await p.screenshot({ path:'scripts/_shots/fix2-corner.png' })
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
