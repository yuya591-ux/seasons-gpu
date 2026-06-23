import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 2 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(3000)
await p.screenshot({ path:'scripts/_shots/cat-rest.png', clip:{x:0,y:740,width:720,height:540} })
for (const r of ['knead','batToy']){
  await p.evaluate((r)=>window.__town3dCatReact(r), r); await p.waitForTimeout(900)
  await p.screenshot({ path:`scripts/_shots/cat-${r}.png`, clip:{x:0,y:740,width:720,height:540} })
  await p.waitForTimeout(2400)
}
console.log(errs.length?'ERR '+errs.slice(0,2).join(' | '):'no errors')
await b.close()
