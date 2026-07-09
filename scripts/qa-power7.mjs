// Step3の残差の切り分け: シェーダーグレードの「ノイズON vs OFF」でノイズの寄与を測り、残差(css vs shader 4.69)がノイズ位相由来かを確認。
// さらに css vs shader-noiseOFF を測る（cssはノイズありなので、これはノイズ1層分の差になるはず＝基盤グレードの一致度の目安）。
import { chromium } from 'playwright'
import fs from 'node:fs'
import { execSync } from 'node:child_process'
const port = process.env.PORT || '4917'
const scene = process.env.SCENE || 'kitaterao-window-3d'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate((s) => window.__applyScene && window.__applyScene(s), scene)
await page.waitForTimeout(2800)
const clip = { clip: { x: 0, y: 0, width: 880, height: 640 } } // 猫/ほこりの動く下部を除外
const shot = (n) => page.screenshot(clip).then((b) => fs.writeFileSync(`scripts/_shots/p7-${n}.png`, b))

await page.evaluate(() => window.__town3dGradeMode('shader')); await page.evaluate(() => window.__town3dGradeNoise(true)); await page.waitForTimeout(160); await shot('sh-nz')
await page.evaluate(() => window.__town3dGradeNoise(false)); await page.waitForTimeout(160); await shot('sh-nonz')
await page.evaluate(() => window.__town3dGradeNoise(true)); await page.waitForTimeout(160); await shot('sh-nz2')
await page.evaluate(() => window.__town3dGradeMode('css')); await page.waitForTimeout(180); await shot('css')
await browser.close()

const diff = (a, b) => execSync(`node scripts/qa-imgdiff.mjs scripts/_shots/p7-${a}.png scripts/_shots/p7-${b}.png 4`).toString().trim().replace(/^\S+:\s*/, '')
console.log('アニメ床値(sh-nz vs sh-nz2):', diff('sh-nz', 'sh-nz2'))
console.log('ノイズ寄与(sh-nz vs sh-nonz):', diff('sh-nz', 'sh-nonz'))
console.log('CSS対シェーダー(ノイズあり) (css vs sh-nz):', diff('css', 'sh-nz'))
console.log('CSS対シェーダー(ノイズ無) (css vs sh-nonz):', diff('css', 'sh-nonz'))
