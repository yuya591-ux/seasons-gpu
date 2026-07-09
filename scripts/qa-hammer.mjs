import { chromium } from 'playwright'
const PORT = process.env.PORT || 4931
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:430,height:850}, deviceScaleFactor:2, isMobile:true, hasTouch:true })
let stack=null; p.on('pageerror',e=>{ if(!stack) stack=e.stack||e.message })
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1500)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
// 江戸の上で fly→land→fly を連打して遷移の競合を炙り出す
for(let i=0;i<24 && !stack;i++){
  await p.evaluate(()=>window.__town3dFlyPose(628,22,-46,Math.random()*6,-0.06)).catch(()=>{}); await p.waitForTimeout(120)
  await p.evaluate(()=>window.__town3dLand && window.__town3dLand(true)).catch(()=>{}); await p.waitForTimeout(700)
  await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(150)
}
console.log('=== stack (hammer) ===')
console.log(stack||'no err after 24 cycles')
await b.close()
