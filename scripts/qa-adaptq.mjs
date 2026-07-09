import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 560 }, deviceScaleFactor: 1.6 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(800)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
const pr = async () => (await p.evaluate(() => window.__town3dStats())).pr
console.log('初期 curPR:', await pr())
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(500)
await p.evaluate(() => window.__town3dCruise(true)) // 能動飛行（巡航）でactive判定
// 巡航しながら数秒。ヘッドレスは重いのでcurPRが下限へ落ちるはず
for (let i=0;i<6;i++){ await p.evaluate(() => window.__town3dSteer(0.05,0)); await p.waitForTimeout(1500); }
console.log('飛行9s後 curPR:', await pr())
console.log(errs.length ? 'ERR ' + errs.slice(0,3).join(' | ') : 'no errors')
await b.close()
