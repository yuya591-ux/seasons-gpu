import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:480,height:780}, deviceScaleFactor:2, isMobile:true, hasTouch:true })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(300)
// 戦国(140,-640) 近くでホバリングしてアンカリング、その後低空で城下を見る
await p.evaluate(()=>window.__town3dFlyPose(140,30,-600,Math.PI,-0.2)).catch(()=>{}); await p.waitForTimeout(3200)
await p.evaluate(()=>window.__town3dFlyPose(135,12,-616,0.2,-0.12)).catch(()=>{}); await p.waitForTimeout(1500)
await p.screenshot({ path:'sengoku-a.png' }); console.log('a')
await p.evaluate(()=>window.__town3dFlyPose(150,10,-628,Math.PI*1.2,-0.08)).catch(()=>{}); await p.waitForTimeout(1500)
await p.screenshot({ path:'sengoku-b.png' }); console.log('b')
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
