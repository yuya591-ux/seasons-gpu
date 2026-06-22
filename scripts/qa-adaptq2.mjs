import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
// 重い構成: 大きなビューポート×高DPR でSwiftShaderを苦しめる
const p = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(800)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
const pr = async () => (await p.evaluate(() => window.__town3dStats())).pr
console.log('初期 curPR:', await pr())
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(500)
await p.evaluate(() => window.__town3dCruise(true))
const log=[]
for (let i=0;i<8;i++){ await p.evaluate(() => window.__town3dSteer(0.04,0)); await p.waitForTimeout(1200); log.push(await pr()) }
console.log('飛行中の curPR 推移:', log.join(' → '))
console.log(errs.length ? 'ERR ' + errs.slice(0,3).join(' | ') : 'no errors')
await b.close()
