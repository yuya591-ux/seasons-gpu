import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 800, height: 500 } })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
// 各時代の中心近くの半透明メッシュを列挙
for (const [name,x,z] of [['江戸',640,-46],['戦国',140,-640],['大正',-640,-30],['本町',0,-30]]) {
  const r = await p.evaluate(([x,z])=>window.__town3dTransparent(x,z,70),[x,z])
  console.log(name, 'transparent meshes:', r.n)
  console.log('  ', JSON.stringify(r.near))
}
await b.close()
