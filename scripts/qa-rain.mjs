import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:430,height:850}, deviceScaleFactor:2, isMobile:true, hasTouch:true })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
for(const s of ['summer-rain-dusk','summer-dusk-downtown','summer-clear-noon','winter-snow-night-downtown']){
  await p.evaluate(x=>window.__applyScene(x), s).catch(()=>{}); await p.waitForTimeout(3200)
  await p.screenshot({ path:`rn-${s}.png` }); console.log('shot '+s)
}
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
