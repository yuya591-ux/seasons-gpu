// Step3検証: 同一の静止窓辺フレームを (a)DOM CSSグレード (b)シェーダーグレード で撮り、一致するかを測る。
// __town3dGradeMode('css'|'shader') で切替（Step3で実装）。カメラ静止の窓辺なら猫/ほこりの動く下部を除き上部はほぼ静止。
// 昼/夕/夜/雪の4条件で回す。SCENE 環境変数で情景IDを渡す。
import { chromium } from 'playwright'
import fs from 'node:fs'
import { execSync } from 'node:child_process'
const port = process.env.PORT || '4917'
const scene = process.env.SCENE || 'kitaterao-window-3d'
const tag = process.env.TAG || scene.replace('kitaterao-window-3d', 'day').replace(/-/g, '')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate((s) => window.__applyScene && window.__applyScene(s), scene)
await page.waitForTimeout(2800)
const hasHook = await page.evaluate(() => typeof window.__town3dGradeMode === 'function')
if (!hasHook) { console.log('__town3dGradeMode 未実装（Step3前）'); await browser.close(); process.exit(0) }

// カメラ静止のまま、グレードだけ切替えて同一フレーム相当を撮る（間120ms＝猫の微動のみ）
await page.evaluate(() => window.__town3dGradeMode('css')); await page.waitForTimeout(150)
fs.writeFileSync(`scripts/_shots/power6-${tag}-css.png`, await page.screenshot())
await page.evaluate(() => window.__town3dGradeMode('shader')); await page.waitForTimeout(150)
fs.writeFileSync(`scripts/_shots/power6-${tag}-shader.png`, await page.screenshot())
// 基準: 同一グレードで2回撮った時のアニメ床値
await page.evaluate(() => window.__town3dGradeMode('shader')); await page.waitForTimeout(150)
fs.writeFileSync(`scripts/_shots/power6-${tag}-shader2.png`, await page.screenshot())
await browser.close()

const diff = (a, b) => execSync(`node scripts/qa-imgdiff.mjs scripts/_shots/power6-${tag}-${a}.png scripts/_shots/power6-${tag}-${b}.png 4`).toString().trim().replace(/^\S+:\s*/, '')
console.log(`[${tag}] アニメ床値(shader vs shader2):`, diff('shader', 'shader2'))
console.log(`[${tag}] CSS対シェーダー(css vs shader):`, diff('css', 'shader'))
