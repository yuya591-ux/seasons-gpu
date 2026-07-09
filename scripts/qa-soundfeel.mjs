// 音の満ち引き検証: 静かな瞬間の鈴・群れの羽音が発火するか／エラーが出ないか
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 480, height: 880 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {}) // クリック＝音響開始のジェスチャ
await p.waitForTimeout(900)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await p.waitForTimeout(2400)
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(700)

// (1) 雲上のくつろぎ場所に着地して佇む＝鈴が満ちるはず
await p.evaluate(() => window.__town3dFlyPose(-20, 120, -286, 0, -0.02)); await p.waitForTimeout(400)
await p.evaluate(() => window.__town3dLand(true)); await p.waitForTimeout(11000)
const c1 = await p.evaluate(() => window.__town3dSoundCounts())

// (2) 飛び立って渡りの群れに並走＝羽音が出るはず（群れ z=-250,y~120 の至近で止空）
await p.evaluate(() => window.__town3dFly(true)); await p.waitForTimeout(500)
await p.evaluate(() => window.__town3dCruise(false))
await p.evaluate(() => window.__town3dFlyPose(-300, 120, -250, 0, 0)); await p.waitForTimeout(6000) // 群れが近づいて通り過ぎる間
const c2 = await p.evaluate(() => window.__town3dSoundCounts())

console.log('REST(鈴):', JSON.stringify(c1))
console.log('FLOCK(羽音, 累計):', JSON.stringify(c2))
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
