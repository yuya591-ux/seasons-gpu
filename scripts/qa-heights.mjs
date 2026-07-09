import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 800, height: 500 } })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
// 戦国の谷の高さプロファイル（川中心 x=140 周辺の横断）
const sen = await p.evaluate(()=>{
  const out=[]
  for(const dz of [-20,-30,-40,-50]){ const z=-640+ ( -0 ) + dz; const row=[]
    for(let dx=-20; dx<=20; dx+=4){ const x=140+dx; const hh=window.__town3dHeights(x,z); row.push({dx,h:hh.heightAt}) }
    out.push({z, row}) }
  return out
})
console.log('SENGOKU valley cross-sections (heightAt):')
for(const r of sen){ console.log(' z='+r.z, r.row.map(c=>c.dx+':'+c.h).join('  ')) }
console.log('SEN waterscan:', JSON.stringify(await p.evaluate(()=>window.__town3dWaterScan(140,-640,50,4))))
console.log('EDO waterscan:', JSON.stringify(await p.evaluate(()=>window.__town3dWaterScan(640,-46,60,5))))
console.log('SEN center heights:', JSON.stringify(await p.evaluate(()=>[[140,-640],[140,-650],[145,-635],[150,-645]].map(([x,z])=>({x,z,...window.__town3dHeights(x,z)})))))
await b.close()
