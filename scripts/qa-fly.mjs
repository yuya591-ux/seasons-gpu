// 浮遊（空を飛ぶ）モードの確認。窓→乗り出し→飛び立ち→各視点を撮り分け、
// 「奥が高速で流れる」破綻が無く、街を好きな位置・角度から見渡せるかを目視する。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const id = process.argv[2] || 'kitaterao-window-3d' // 立体の街（kind:town）
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
await page.waitForTimeout(1800)
await page.addStyleTag({ content: '.ui{display:none !important}' })

// 窓をあけ→乗り出し→飛び立ち
await page.evaluate(() => window.__town3dWindow(true))
await page.waitForTimeout(1500)
await page.evaluate(() => window.__town3dLean(true))
await page.waitForTimeout(2000)
await page.evaluate(() => window.__town3dFlyToggle(true))
await page.waitForTimeout(900) // 飛び立ちのブレンド途中
await page.screenshot({ path: 'scripts/_shots/fly-0-takeoff.png' })

// 自然な滑空を少し（前進＋ゆるい上昇/下降の確認）
await page.waitForTimeout(2200)
await page.screenshot({ path: 'scripts/_shots/fly-1-glide.png' })

// 任意の視点へ飛ばして見渡す（高所からの俯瞰）
await page.evaluate(() => window.__town3dFlyPose(0, 70, 6, 0, -0.7))
await page.waitForTimeout(500)
await page.screenshot({ path: 'scripts/_shots/fly-2-high.png' })

// 横手から街を横断して眺める
await page.evaluate(() => window.__town3dFlyPose(52, 40, -38, -1.0, -0.42))
await page.waitForTimeout(500)
await page.screenshot({ path: 'scripts/_shots/fly-3-side.png' })

// 屋根すれすれの低空（接地レベルの密度を確認＝C工程の足がかり）
await page.evaluate(() => window.__town3dFlyPose(0, 12, -8, 0, -0.12))
await page.waitForTimeout(500)
await page.screenshot({ path: 'scripts/_shots/fly-4-low.png' })

// 境界の確認: 箱の外へ飛ばしても縁を見せず内側に留まるか（z手前の壁へ突進）
await page.evaluate(() => window.__town3dFlyPose(0, 30, 30, 0, 0.0))
await page.waitForTimeout(1600) // 速度×時間で前進→zMaxにクランプされるはず
const pos = await page.evaluate(() => {
  const a = window.__town3dDbg && window.__town3dDbg()
  return a || null
})
await page.screenshot({ path: 'scripts/_shots/fly-5-bound.png' })

// 窓へもどる（地続きに戻れるか）
await page.evaluate(() => window.__town3dFlyToggle(false))
await page.waitForTimeout(2000)
await page.screenshot({ path: 'scripts/_shots/fly-6-return.png' })

await browser.close()
console.log('shot fly states: takeoff/glide/high/side/low/bound/return', pos ? JSON.stringify(pos) : '')
