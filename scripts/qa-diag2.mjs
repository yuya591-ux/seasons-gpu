// 総合診断の撮影: 症状（電車の軌道外れ/踏切ズレ/車の家貫通/道路の形/人・動物の造形）を実写で確認する
import { chromium } from 'playwright'
import fs from 'node:fs'
const port = process.env.PORT || '4890'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(1000)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1300)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.evaluate(() => window.__town3dCruise(false))
await page.addStyleTag({ content: '.ui{display:none !important}' })

const save = (dataUrl, name) => { if (!dataUrl) { console.log('SHOT失敗:', name); return } fs.writeFileSync(`scripts/_shots/diag-${name}.png`, Buffer.from(dataUrl.split(',')[1], 'base64')) }
const shotAt = async (name, cx, cy, cz, lx, ly, lz, fov) => save(await page.evaluate(([a, b, c, d, e, f, g]) => window.__town3dShotAt(a, b, c, d, e, f, g), [cx, cy, cz, lx, ly, lz, fov || 55]), name)

// ── 1. 隔離接写: 猫(sc0.55)/馬(sc1.1)/車 の造形そのもの ──
save(await page.evaluate(() => window.__town3dQuadShot(0x8a7a5a, 0.55, 2.2)), 'quad-cat')
save(await page.evaluate(() => window.__town3dQuadShot(0x5a4030, 1.1, 2.2)), 'quad-horse')
save(await page.evaluate(() => window.__town3dCarShot()), 'car')
save(await page.evaluate(() => window.__town3dFigShot(0.5)), 'resident')

// ── 2. peep(中品質・多数)を接写 ──
await page.evaluate(() => { const y = window.__town3dGroundAt(2, 8); window.__town3dPeepPin(0, 2, 8, 0, y) })
await page.waitForTimeout(300)
{ const y = await page.evaluate(() => window.__town3dGroundAt(2, 8)); await shotAt('peep-close', 2, y + 1.35, 10.6, 2, y + 1.0, 8, 42) }

// ── 3. 電車: 西端の軌道外区間(x=-24.3〜-6, レール無し)を連続フレームで捕捉 ──
{
  const y = await page.evaluate(() => window.__town3dGroundAt(-14, -46))
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(1000)
    await shotAt(`train-west-${i}`, -14, y + 5.5, -40, -14, y + 1.2, -51.4, 60)
  }
}

// ── 4. 踏切: 中央通り(x=0)と線路の交差点。踏切(crossX=6)のズレを俯瞰 ──
await shotAt('crossing-offset', 2, 15, -37, 2, 0, -51.4, 60)

// ── 5. 車が家の建つ区間(z<-27)を走る様子: 俯瞰+低位置で連続 ──
for (let i = 0; i < 3; i++) {
  await page.waitForTimeout(1300)
  await shotAt(`car-house-top-${i}`, 0, 24, -46, 0, 0, -47, 60)
  await shotAt(`car-house-low-${i}`, 6, 2.6, -38, -1, 1, -44, 55)
}

// ── 6. 道路網の俯瞰(形の崩れ) ──
await shotAt('road-overview', 20, 58, 18, 0, 0, -28, 60)
await shotAt('road-mid', 4, 9, 8, 0, 0.5, -8, 60)

// ── 7. 江戸の群衆(mkCrowdPerson/mkWalkerFig)を地上目線で ──
await page.evaluate(() => window.__town3dFlyPose && window.__town3dFlyPose(648, 8, -34, 2.2, -0.1))
await page.waitForTimeout(1800)
{
  const y = await page.evaluate(() => window.__town3dGroundAt(646, -40))
  await shotAt('edo-crowd-1', 646, y + 1.7, -38, 640, y + 1.1, -46, 55)
  await shotAt('edo-crowd-2', 644, y + 1.6, -42, 638, y + 1.0, -50, 48)
}
await browser.close()
console.log('diag shots done')
