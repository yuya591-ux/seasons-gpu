import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 640 }, deviceScaleFactor: 2.2 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset')); await p.waitForTimeout(2800)
// 右壁(テレビ/柱時計)を見る
await p.evaluate(()=>{ for(let i=0;i<14;i++) window.__town3dLook(26,0) }); await p.waitForTimeout(900)
await p.screenshot({ path:'scripts/_shots/room-right.png' })
// 左壁(整理ダンス/茶箪笥)を見る
await p.evaluate(()=>{ for(let i=0;i<28;i++) window.__town3dLook(-26,0) }); await p.waitForTimeout(900)
await p.screenshot({ path:'scripts/_shots/room-left.png' })
// ちゃぶ台(下)を見る
await p.evaluate(()=>{ for(let i=0;i<14;i++) window.__town3dLook(26,0); for(let i=0;i<6;i++) window.__town3dLook(0,-22) }); await p.waitForTimeout(900)
await p.screenshot({ path:'scripts/_shots/room-table.png' })
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
