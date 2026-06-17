// 各公開情景の実描画から、ギャラリー用サムネを生成して public/thumbs/<id>.jpg に保存する。
// 使い方: プレビュー(4790, dev hooks入りビルド)起動中に node scripts/gen-thumbs.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('public/thumbs', { recursive: true })

const port = process.env.PORT || '4790'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1 })
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(400)
// UIを隠してから撮る（サムネに操作UIを写さない）
await page.addStyleTag({ content: '.ui{display:none !important}' })

const ids = await page.evaluate(() => window.__sceneIds || [])
console.log('情景:', ids.join(', '))
for (const id of ids) {
  await page.evaluate((sid) => window.__applyScene(sid), id)
  await page.waitForTimeout(3200) // 描画が安定するまで（town3dは遅延import＋シーン構築があるので長め）
  // 中央を切り出してサムネに（窓枠の外周を避け、景色の核を見せる）
  await page.screenshot({ path: `public/thumbs/${id}.jpg`, type: 'jpeg', quality: 82,
    clip: { x: 80, y: 55, width: 740, height: 490 } })
  console.log('撮影:', id)
}
await browser.close()
console.log('完了')
