import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1.8 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
await p.evaluate(()=>window.__applyScene('summer-morning-corner-room')); await p.waitForTimeout(2800)
await p.screenshot({ path:'scripts/_shots/cwin-center.png' })
// 左へ徐々に振って二つ目の窓を探す
for (const [n,tag] of [[6,'l30'],[6,'l60'],[6,'l90']]) {
  await p.evaluate((n)=>{ for(let i=0;i<n;i++) window.__town3dLook(-28,0) }, n); await p.waitForTimeout(700)
  await p.screenshot({ path:`scripts/_shots/cwin-${tag}.png` })
}
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
