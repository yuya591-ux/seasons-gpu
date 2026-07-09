import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1.5 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(900)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')); await p.waitForTimeout(2600)
const dbg = async () => p.evaluate(()=>window.__audio.getDebug())
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
// 商店街(0,-28)の低空
await p.evaluate(()=>window.__town3dFlyPose(0,5,-28,0,-0.05)); await p.waitForTimeout(1800)
console.log('shoten:', JSON.stringify(await dbg()))
// 人気のない場所(丘の上 -90,-90 低空)
await p.evaluate(()=>window.__town3dFlyPose(-90,8,-90,0,-0.05)); await p.waitForTimeout(1800)
console.log('quiet :', JSON.stringify(await dbg()))
// 商店街の高空
await p.evaluate(()=>window.__town3dFlyPose(0,55,-28,0,-0.3)); await p.waitForTimeout(1800)
console.log('high  :', JSON.stringify(await dbg()))
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
