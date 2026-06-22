// 虹のアーチ・渡りの群れ・雲の滝 の検証
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

// (1) 虹のアーチを南から望む（アーチ z=-360、群島の北の空にかかる）
await p.evaluate(() => window.__town3dFlyPose(-20, 122, -250, 0, 0.06)); await p.waitForTimeout(1000)
await p.screenshot({ path: 'scripts/_shots/extra-1-rainbow.png' })

// (2) 虹をくぐる（アーチ面 z=-360 の開口内＝分光のベール）
await p.evaluate(() => window.__town3dFlyPose(-20, 110, -360, 0, 0)); await p.waitForTimeout(900)
await p.screenshot({ path: 'scripts/_shots/extra-2-through.png' })

// (3) 渡りの群れ（+Xへ渡る。経路 z=-250,y~120 の後方至近から望む。約9秒で先頭 x≈-293）
await p.evaluate(() => window.__town3dFlyPose(-318, 122, -250, Math.PI / 2, 0.02)); await p.waitForTimeout(1200)
await p.screenshot({ path: 'scripts/_shots/extra-3-flock.png' })

// (4) 雲の滝（78,-232 を横手前下から望む。雲海から下へ流れ落ちる）
await p.evaluate(() => window.__town3dFlyPose(132, 84, -232, -1.5708, -0.12)); await p.waitForTimeout(1200)
await p.screenshot({ path: 'scripts/_shots/extra-4-fall.png' })

console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
