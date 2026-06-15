// 指定した情景IDだけサムネを生成（既存サムネを上書きしない）。
// 使い方: dev/プレビュー起動中に node scripts/gen-thumbs-some.mjs <id> [<id> ...]
//         ポートは環境変数 PORT で変更可（既定 4790）。例: PORT=4792 node scripts/gen-thumbs-some.mjs <id>
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('public/thumbs', { recursive: true })
const ids = process.argv.slice(2)
if (!ids.length) { console.log('IDを指定してください'); process.exit(1) }
const port = process.env.PORT || '4790'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1 })
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(400)
await page.addStyleTag({ content: '.ui{display:none !important}' })

for (const id of ids) {
  await page.evaluate((sid) => window.__applyScene(sid), id)
  await page.waitForTimeout(3200) // 3Dの街は遅延importとシーン構築があるので長めに待つ
  await page.screenshot({ path: `public/thumbs/${id}.jpg`, type: 'jpeg', quality: 82,
    clip: { x: 80, y: 55, width: 740, height: 490 } })
  console.log('撮影:', id)
}
await browser.close()
console.log('完了')
