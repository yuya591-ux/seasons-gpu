// じゃれ追いの確認: 玉を遠くに置いて即チェイス→猫が歩み寄って打つか。位置の推移＋スクショ＋エラー検知。
import { chromium } from 'playwright'
const port = process.env.PORT || '5114'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 760 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(500)
await page.addStyleTag({ content: '.ui{display:none !important}' })
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(3000)
await page.evaluate(() => window.__town3dSetView(0.0, -0.52)); await page.waitForTimeout(800)
const start = await page.evaluate(() => window.__town3dCatChase(-0.3, 1.25)) // 玉を左手前へ置き即じゃれ追い
console.log('start', JSON.stringify(start))
for (let i = 0; i < 9; i++) {
  // idle省電力でループが間引かれないよう、マウスを少し動かして操作中を維持（実使用=玉で遊ぶ操作中に相当）
  for (let k = 0; k < 9; k++) { await page.mouse.move(230 + (k % 2) * 6, 360 + (k % 3) * 4); await page.waitForTimeout(100) }
  const s = await page.evaluate(() => window.__town3dCatState2())
  console.log('t' + i, JSON.stringify(s))
  if (i === 3) await page.screenshot({ path: 'scripts/_shots/catchase-mid.png' })
  if (i === 7) await page.screenshot({ path: 'scripts/_shots/catchase-end.png' })
}
await browser.close()
console.log('check done')
