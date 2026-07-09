// Step2 AB検証: 昼ブルームOFF＋MSAA0の前後で見た目がほぼ識別不可かを、同一構図のスクショで撮る。
// TAG=before|after で保存名を分ける。窓辺(昼)・home低空(昼・太陽/水面のきらめき)・夜窓辺(灯りのブルームが不変か)を撮る。
import { chromium } from 'playwright'
import fs from 'node:fs'
const port = process.env.PORT || '4917'
const TAG = process.env.TAG || 'before'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)

// 昼の窓辺（既定＝夏夕方だが太陽域は明るい。__driftToで昼側へ寄せる）
// 既定シーンは duskAmt≈0 の昼＝0.05の昼ブルームが焚かれている＝Step2-Fの検証対象そのもの
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(3000)
fs.writeFileSync(`scripts/_shots/power3-${TAG}-day-window.png`, await page.screenshot())

// home低空（昼・太陽のきらめき/屋根のハイライトが出やすい構図）
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(700)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1000)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.evaluate(() => window.__town3dCruise && window.__town3dCruise(false))
await page.evaluate(() => window.__town3dFlyPose(0, 26, 40, 0, -0.15)); await page.waitForTimeout(1400)
fs.writeFileSync(`scripts/_shots/power3-${TAG}-day-fly.png`, await page.screenshot())

// 夜の窓辺（灯りのブルームが不変であるべき＝ここは変わってはいけない）
await page.evaluate(() => window.__town3dFly(false)); await page.waitForTimeout(1500)
await page.evaluate(() => window.__town3dLean(false)); await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d-night'))
await page.waitForTimeout(2600)
fs.writeFileSync(`scripts/_shots/power3-${TAG}-night-window.png`, await page.screenshot())

// 細い輪郭のシマー確認用（電線/建物エッジが多い低速パン構図）＝MSAA0の影響を見る
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2200)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(700)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1000)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.evaluate(() => window.__town3dCruise && window.__town3dCruise(false))
await page.evaluate(() => window.__town3dFlyPose(-30, 14, -40, 0.6, 0)); await page.waitForTimeout(1400)
fs.writeFileSync(`scripts/_shots/power3-${TAG}-edges.png`, await page.screenshot())

await browser.close()
console.log(`qa-power3 (${TAG}) done`)
