import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 800, height: 500 } })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
// 戦国の街路あたり(140,-636)の上空数点で近傍メッシュを列挙
for (const y of [14, 25, 40]) {
  const r = await p.evaluate(([y])=>window.__town3dTransparent(140,y,-636,28),[y])
  console.log(`y=${y} 近傍メッシュ ${r.n}:`)
  for (const m of r.near) console.log('  ', JSON.stringify(m))
}
await b.close()
