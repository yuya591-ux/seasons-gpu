// 雲上のくつろぎ場所＝空から眺める→着地→佇む→歩く の検証
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 920, height: 560 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await p.waitForTimeout(2400)
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(() => window.__town3dCruise(false))

// (A) 空から くつろぎ場所(-20,-290) を望む（東屋・鳥居・灯籠・木の浮島）
await p.evaluate(() => window.__town3dFlyPose(-20, 122, -250, 0, -0.34)); await p.waitForTimeout(1100)
await p.screenshot({ path: 'scripts/_shots/rest-1-air.png' })

// (B) 真上へ寄せて着地（雲上の浮島に降り立つ）
await p.evaluate(() => window.__town3dFlyPose(-20, 120, -286, 0, -0.02)); await p.waitForTimeout(500)
await p.evaluate(() => window.__town3dLand(true)); await p.waitForTimeout(1800)
const dbg = await p.evaluate(() => window.__town3dDbg())
await p.screenshot({ path: 'scripts/_shots/rest-2-stand.png' })

// (C) 縁台のほうへ向き直って佇む（中心の東屋を望む）
await p.evaluate(() => window.__town3dSetView(Math.PI, -0.05)); await p.waitForTimeout(200)
await p.evaluate(() => window.__town3dMove(0, 0.6)); await p.waitForTimeout(900); await p.evaluate(() => window.__town3dMove(0, 0))
await p.waitForTimeout(500)
await p.screenshot({ path: 'scripts/_shots/rest-3-walk.png' })

console.log('DBG:', JSON.stringify(dbg))
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
