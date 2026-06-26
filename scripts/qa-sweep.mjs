import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const SCENES = [
  'kitaterao-window-3d','kitaterao-window-3d-autumn','kitaterao-window-3d-night','kitaterao-window-3d-rain',
  'kitaterao-window-3d-rain-night','kitaterao-window-3d-snow','kitaterao-window-3d-snow-night','kitaterao-window-3d-spring','kitaterao-window-3d-sunset',
  'shishigaya-window-3d','shishigaya-window-3d-autumn','shishigaya-window-3d-snow','shishigaya-window-3d-spring','shishigaya-morning-yato',
  'kitaterao-rooftop','kitaterao-rooftop-night',
  'autumn-dusk-corner-room','autumn-rain-dusk','autumn-rain-night-corner-room',
  'spring-dusk-corner-room','spring-morning-corner-room','summer-morning-corner-room','winter-snow-dusk-corner-room',
  'summer-clear-noon','summer-dusk-downtown','summer-dusk-seaside','summer-morning-mountains',
  'summer-rain-dusk','summer-rain-morning','summer-rain-night','summer-rain-night-downtown','winter-snow-night-downtown',
  'photo-window-town','photo-window-sea','photo-window-autumn','photo-window-dusk','photo-window-night','photo-window-spring','photo-window-winter','photo-window-snow-night',
]
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:430,height:850}, deviceScaleFactor:2, isMobile:true, hasTouch:true })
let cur=''; const hits=[]
p.on('pageerror',e=>hits.push(`[${cur}] PE: ${e.message}`))
p.on('console',m=>{ if(m.type()==='error'){ const t=m.text(); if(!/Failed to load resource|favicon|404|net::ERR/.test(t)) hits.push(`[${cur}] CE: ${t.slice(0,140)}`) }})
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
for(const s of SCENES){
  cur=s
  await p.evaluate(x=>window.__applyScene(x), s).catch(e=>hits.push(`[${s}] applyScene throw: ${e.message}`))
  await p.waitForTimeout(2200)
}
console.log('=== loaded '+SCENES.length+' scenes ===')
console.log(hits.length? hits.join('\n') : 'NO ERRORS across all scenes')
await b.close()
