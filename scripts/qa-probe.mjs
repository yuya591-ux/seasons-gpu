import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 800, height: 500 } })
p.on('console', (m) => { if (m.type() === 'error') console.log('ERR', m.text()) })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(800)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
// 住宅街の数点で、塞がり具合と16方位の通行距離を見る
for (const [x,z] of [[-40,-58],[28,-58],[14,-40],[0,-36],[-20,-20]]) {
  const pr = await p.evaluate(([x,z]) => window.__town3dProbe(x,z), [x,z])
  const cl = await p.evaluate(([x,z]) => window.__town3dClear(x,z), [x,z])
  console.log(`(${x},${z}) blocked=${pr.blocked} nColliders=${pr.nColliders}`)
  console.log('  near:', JSON.stringify(pr.near))
  console.log('  16方位の通行距離:', cl.join(' '))
}
await b.close()
