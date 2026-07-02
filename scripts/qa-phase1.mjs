// Phase1修正の検証第2弾: 電車のレール外非表示（メッシュ列挙で時系列確認）＋踏切x=0の見た目
import { chromium } from 'playwright'
import fs from 'node:fs'
const port = process.env.PORT || '4890'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
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

const save = (dataUrl, name) => { if (!dataUrl) { console.log('SHOT失敗:', name); return } fs.writeFileSync(`scripts/_shots/fix2-${name}.png`, Buffer.from(dataUrl.split(',')[1], 'base64')) }
const shotAt = async (name, cx, cy, cz, lx, ly, lz, fov) => save(await page.evaluate(([a, b, c, d, e, f, g]) => window.__town3dShotAt(a, b, c, d, e, f, g), [cx, cy, cz, lx, ly, lz, fov || 55]), name)

// 旧軌道外区間(-15,-51.4)と レール上(20,-51.4) の可視メッシュ数を30秒間サンプリング。
// RoundedBoxGeometry(電車の車体)が旧区間に一度でも現れたら失敗、レール上に現れたら電車の運行は健在。
let offRail = 0, onRail = 0
for (let i = 0; i < 40; i++) {
  const [a, b] = await page.evaluate(() => [
    window.__town3dTransparent(-15, 1.8, -51.4, 7).near.filter((m) => m.type === 'RoundedBoxGeometry' && m.y > 0.8 && m.y < 3.5).length,
    window.__town3dTransparent(20, 1.8, -51.4, 7).near.filter((m) => m.type === 'RoundedBoxGeometry' && m.y > 0.8 && m.y < 3.5).length,
  ])
  offRail += a; onRail += b
  await page.waitForTimeout(750)
}
console.log(`旧軌道外区間の可視車体ヒット: ${offRail} (0なら合格) / レール上の可視車体ヒット: ${onRail} (>0なら運行健在)`)

// 踏切: 道路上の低い視点から北の線路方向を見る（遮断機・警報機が両肩に立つ様子）
{
  const y = await page.evaluate(() => window.__town3dGroundAt(0, -42))
  await shotAt('crossing-road-eye', 0, y + 2.4, -40, 0, y + 1.2, -52, 62)
  await shotAt('crossing-side', 8, y + 4, -47, -2, y + 1, -51.5, 58)
}
await browser.close()
console.log('phase1検証 done')
