import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(()=>window.__town3dCruise(false))
// 戦国の真上から俯瞰
await p.evaluate(()=>window.__town3dFlyPose(150,120,-650,0,-1.45)); await p.waitForTimeout(900)
await p.screenshot({ path:'scripts/_shots/coh-sen-top.png' })
// 南の河口側を斜め上から
await p.evaluate(()=>window.__town3dFlyPose(150,60,-560,0,-0.7)); await p.waitForTimeout(900)
await p.screenshot({ path:'scripts/_shots/coh-sen-mouth.png' })
// 南端の街の家の高さ（河口付近）
const south = await p.evaluate(()=>{ const r=[]; for(let z=-560; z>=-620; z-=10){ const row=[]; for(let dx=-16; dx<=16; dx+=8){ row.push(window.__town3dHeights(140+dx,z).heightAt) } r.push({z,row}) } return r })
console.log('south city heights (z=-560..-620):'); for(const r of south) console.log(' z='+r.z, r.row.join(' '))
await b.close()
