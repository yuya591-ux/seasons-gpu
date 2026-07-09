import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:520,height:640}, deviceScaleFactor:2 })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1500)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(300)
// 集合住宅の塔(-20,-44付近)の壁を間近に：自由カメラで正対
await p.evaluate(()=>window.__town3dFlyPose(-20,10,-30,0,0)).catch(()=>{}); await p.waitForTimeout(700)
await p.evaluate(()=>window.__town3dShotAt(-12, 6, -44, -20, 7, -44, 38)).catch(()=>{}); await p.waitForTimeout(500)
await p.screenshot({ path:'wall2.png' }); console.log('shot')
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
