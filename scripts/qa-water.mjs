import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1.5 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{}) // ユーザー操作=audio開始
await p.waitForTimeout(900)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')); await p.waitForTimeout(2600)
const dbg = async () => p.evaluate(()=>window.__audio&&window.__audio.getDebug&&window.__audio.getDebug())
console.log('init:', JSON.stringify(await dbg()))
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
// 陸の上（home中心の低空）
await p.evaluate(()=>window.__town3dFlyPose(0,10,-20,0,-0.05)); await p.waitForTimeout(1800)
console.log('land:', JSON.stringify(await dbg()))
// 東の海の上（x>82, 低空）
await p.evaluate(()=>window.__town3dFlyPose(120,9,-30,1.57,-0.05)); await p.waitForTimeout(1800)
console.log('sea :', JSON.stringify(await dbg()))
// homeの川の近く（x=-52, 低空）
await p.evaluate(()=>window.__town3dFlyPose(-52,7,-40,0,-0.05)); await p.waitForTimeout(1800)
console.log('river:', JSON.stringify(await dbg()))
// 高空（海の上でも波は弱まる）
await p.evaluate(()=>window.__town3dFlyPose(120,70,-30,1.57,-0.3)); await p.waitForTimeout(1800)
console.log('seaHigh:', JSON.stringify(await dbg()))
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
