// F(昼ブルーム)の決定的隔離: 窓辺(カメラ完全静止・オートシネマ無し)で時間凍結し、ON→OFF→ON を撮る。
// 窓の上部=明るい空(ブルームが効く)。下部=室内(猫/ほこりが動く)。上下別々にも差分を出す。
import { chromium } from 'playwright'
import fs from 'node:fs'
import { execSync } from 'node:child_process'
const port = process.env.PORT || '4917'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__driftTo && window.__driftTo(0.15)) // 昼に固定
// 窓をあけて空を広く見せる（乗り出しはしない＝カメラ静止のまま）。
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(1400)
console.log('bloom info:', JSON.stringify(await page.evaluate(() => window.__town3dBloomInfo())))

const shot = (n) => page.screenshot({ clip: { x: 0, y: 0, width: 880, height: 620 } }).then((b) => fs.writeFileSync(`scripts/_shots/power5-${n}.png`, b)) // 上部=窓の空だけ切り出し(猫/ほこりの動く下部を除外)
await page.evaluate(() => window.__town3dBloom(true)); await page.waitForTimeout(160); await shot('on1')
await page.evaluate(() => window.__town3dBloom(false)); await page.waitForTimeout(160); await shot('off')
await page.evaluate(() => window.__town3dBloom(true)); await page.waitForTimeout(160); await shot('on2')
await browser.close()

const diff = (a, b) => execSync(`node scripts/qa-imgdiff.mjs scripts/_shots/power5-${a}.png scripts/_shots/power5-${b}.png 4`).toString().trim().replace(/^power5-\S+:\s*/, '')
console.log('窓上部の空 アニメ床値(on1 vs on2):', diff('on1', 'on2'))
console.log('窓上部の空 ブルーム寄与(on1 vs off):', diff('on1', 'off'))
console.log('qa-power5 done')
