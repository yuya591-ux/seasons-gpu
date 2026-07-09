// 白飛びの第二源の切り分け: 同じカメラ位置から、flyPosの高さだけ変えて撮る。
// 雲海(seaOp)/入道雲・島(cloudHi)は flyPos.y で表示が変わる＝写り込みの犯人を特定できる。
import { chromium } from 'playwright'
import fs from 'node:fs'
const port = process.env.PORT || '4890'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(1000)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1300)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.evaluate(() => window.__town3dCruise(false))
await page.addStyleTag({ content: '.ui{display:none !important}' })
const save = (dataUrl, name) => { if (!dataUrl) { console.log('SHOT失敗:', name); return } fs.writeFileSync(`scripts/_shots/wo2-${name}.png`, Buffer.from(dataUrl.split(',')[1], 'base64')) }
const shotAt = (cx, cy, cz, lx, ly, lz, fov) => page.evaluate(([a, b, c, d, e, f, g]) => window.__town3dShotAt(a, b, c, d, e, f, g), [cx, cy, cz, lx, ly, lz, fov || 58])

// 被写体位置（after検証で塊が写った構図）: カメラ(7.7, 81.1, -60.9) → 北(7.7, 81.1, -93.9)
const P = [7.7, 81.1, -60.9], L = [7.7, 81.1, -93.9]
// S1: flyPosも同じ位置（=実際の飛行状態）
await page.evaluate(([x, y, z]) => window.__town3dFlyPose(x, y, z, Math.PI, 0), P)
await page.waitForTimeout(400)
save(await shotAt(...P, ...L), 's1-fly81')
// S2: flyPosだけ y=40（雲海seaOp=0・cloudHi=false=入道雲/島も非表示）
await page.evaluate(([x, z]) => window.__town3dFlyPose(x, 40, z, Math.PI, 0), [P[0], P[2]])
await page.waitForTimeout(400)
save(await shotAt(...P, ...L), 's2-fly40')
// S3: flyPosだけ y=60（cloudHi=true=入道雲は出る・雲海seaOp=0）
await page.evaluate(([x, z]) => window.__town3dFlyPose(x, 60, z, Math.PO === undefined ? Math.PI : Math.PI, 0), [P[0], P[2]])
await page.waitForTimeout(400)
save(await shotAt(...P, ...L), 's3-fly60')
// S4: 実飛行で高度帯スキャン y=75..100（ユーザー報告の帯を再現）
for (const y of [75, 82, 88, 92, 98]) {
  await page.evaluate(([x, yy, z]) => window.__town3dFlyPose(x, yy, z, Math.PI, 0), [P[0], y, P[2]])
  await page.waitForTimeout(350)
  save(await shotAt(P[0], y, P[2], P[0], y - 4, P[2] - 33), `s4-y${y}`)
}
await browser.close()
console.log('qa-whiteout2 done')
