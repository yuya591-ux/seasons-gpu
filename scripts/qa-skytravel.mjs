// 空を旅する立体感の検証: 巡航(雲海なし)→雲海突入→入道雲→浮島の鳥居→雲の中の白包み
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 920, height: 560 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await p.waitForTimeout(2400)
await p.evaluate(() => window.__town3dFly(true))
await p.waitForTimeout(700)
await p.evaluate(() => window.__town3dCruise(false)) // その場ホバーで静止撮影
await p.waitForTimeout(300)

// (1) 巡航高度＝雲海は出ず、街が一望できる（y=46）
await p.evaluate(() => window.__town3dFlyPose(0, 46, -10, 0, -0.28))
await p.waitForTimeout(1000)
await p.screenshot({ path: 'scripts/_shots/sky-1-cruise.png' })

// (2) 雲海の上を旅する目線＝街は雲の下に消え、うねる雲の海が地平へ広がる（y=126、前方やや下）
await p.evaluate(() => window.__town3dFlyPose(0, 126, -40, 0.1, -0.26))
await p.waitForTimeout(1300)
await p.screenshot({ path: 'scripts/_shots/sky-2-sea.png' })

// (3) 入道雲が雄大に聳える（y=116、塔(170,-330)を見上げる）
await p.evaluate(() => window.__town3dFlyPose(170, 116, -240, 0, 0.12))
await p.waitForTimeout(1000)
await p.screenshot({ path: 'scripts/_shots/sky-3-towers.png' })

// (4) 浮島の鳥居へ近づく（島は -60,108,-440。手前 z=-372 から北(-z)へ向き、わずかに見下ろす）
await p.evaluate(() => window.__town3dFlyPose(-60, 118, -372, 0, -0.08))
await p.waitForTimeout(1300)
await p.screenshot({ path: 'scripts/_shots/sky-4-island.png' })

// (5) 雲塊のただ中＝白く包まれる突き抜けの手応え（y=102）
await p.evaluate(() => window.__town3dFlyPose(80, 102, -120, 0.3, -0.05))
await p.waitForTimeout(1000)
await p.screenshot({ path: 'scripts/_shots/sky-5-punch.png' })

// (6) 雲海のぬし（鯨）＝起動から約10秒で x≈-198,z=-210 付近。横手前から全身を望む
await p.evaluate(() => window.__town3dFlyPose(-196, 124, -142, 0, -0.08))
await p.waitForTimeout(1400)
await p.screenshot({ path: 'scripts/_shots/sky-6-whale.png' })

// (7) 雲の切れ間＝街の上の穴(15,-25)を見下ろし、はるか下の地上が覗く
await p.evaluate(() => window.__town3dFlyPose(15, 126, 18, 0, -0.5))
await p.waitForTimeout(1200)
await p.screenshot({ path: 'scripts/_shots/sky-7-gap.png' })

// (8) ブロッケンの虹輪＝開けた雲海の上から真下を見下ろす（自分の影を囲む円い虹）
await p.evaluate(() => window.__town3dFlyPose(-30, 124, -250, 0, -0.5))
await p.waitForTimeout(1200)
await p.screenshot({ path: 'scripts/_shots/sky-8-glory.png' })

console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
