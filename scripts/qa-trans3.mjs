import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 800, height: 500 } })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
// 戦国の空の高所(y30-70)の近傍メッシュを探す
for (const [x,y,z] of [[140,35,-630],[140,55,-625],[120,40,-640],[160,40,-635]]) {
  const r = await p.evaluate(([x,y,z])=>window.__town3dTransparent(x,y,z,22),[x,y,z])
  console.log(`(${x},${y},${z}) 近傍 ${r.n}:`)
  for (const m of r.near.slice(0,6)) console.log('  ', JSON.stringify(m))
}
await b.close()
