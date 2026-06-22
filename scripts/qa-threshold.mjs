// 踏み出す閾の検証: 窓→空の遷移途中で 前へのめり＋光が開ける が出るか（連続フレーム）
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 720, height: 900 }, deviceScaleFactor: 2 })
const errs = []
p.on('pageerror', (e) => errs.push(String(e)))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await p.waitForTimeout(2400)
await p.screenshot({ path: 'scripts/_shots/thr-0-room.png' }) // 窓辺（部屋）
await p.evaluate(() => window.__town3dFly(true))
await p.waitForTimeout(240); await p.screenshot({ path: 'scripts/_shots/thr-1.png' }) // 踏み出し序盤
await p.waitForTimeout(200); await p.screenshot({ path: 'scripts/_shots/thr-2.png' }) // 閾の山
await p.waitForTimeout(260); await p.screenshot({ path: 'scripts/_shots/thr-3.png' }) // 抜け出る
await p.waitForTimeout(1400); await p.screenshot({ path: 'scripts/_shots/thr-4-aloft.png' }) // 空へ
const dbg = await p.evaluate(() => window.__town3dDbg())
console.log('DBG:', JSON.stringify(dbg))
console.log(errs.length ? 'ERR ' + errs.slice(0, 4).join(' | ') : 'no errors')
await b.close()
