import { chromium } from 'playwright'
const PORT = process.env.PORT || 4931
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 420, height: 760 }, deviceScaleFactor: 1 })
const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await p.locator('.gate').click().catch(() => {}); await p.waitForTimeout(1000)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(() => {}); await p.waitForTimeout(2800)
await p.evaluate(() => window.__town3dFly && window.__town3dFly(true)).catch(() => {}); await p.waitForTimeout(800)

// 指定位置へ置き、climb方向に1.4秒ぶん動かしてyの変化量を測る
async function trial(name, x, y, z, dir) {
  await p.evaluate(([x, y, z]) => window.__town3dFlyPose(x, y, z, 0, 0), [x, y, z])
  await p.waitForTimeout(250)
  const before = await p.evaluate(() => window.__town3dDbg())
  // 毎フレーム climb を入れ直す（ボタン押しっぱなし相当。winClimbUp等で0に戻されても効くように）
  for (let i = 0; i < 14; i++) { await p.evaluate((d) => window.__town3dClimb(d), dir); await p.waitForTimeout(100) }
  const after = await p.evaluate(() => window.__town3dDbg())
  await p.evaluate(() => window.__town3dClimb(0))
  const h = await p.evaluate(([x, z]) => window.__town3dHeights(x, z), [x, z])
  console.log(`${name} dir=${dir>0?'up ':'down'} y ${before.y}→${after.y} (Δ${(after.y-before.y).toFixed(1)})  floor=${(h.heightAt+4.5).toFixed(1)} (heightAt=${h.heightAt})`)
}

console.log('--- home（原点近く） ---')
await trial('home   ', 0, 60, 30, -1)
await trial('home   ', 0, 60, 30, +1)
console.log('--- 戦国エリア（中心 140,-640） ---')
await trial('sen中心 ', 140, 60, -640, -1)
await trial('sen中心 ', 140, 60, -640, +1)
console.log('--- 戦国の城の尾根あたり ---')
await trial('sen尾根 ', 168, 60, -648, -1)
await trial('sen尾根 ', 168, 60, -648, +1)
console.log('--- 戦国へ渡る海の上 ---')
await trial('渡海   ', 90, 60, -380, -1)
await trial('渡海   ', 90, 60, -380, +1)
console.log(errs.length ? 'ERR ' + errs.slice(0, 3).join(' | ') : 'no err')
await b.close()
