// 全シェーダー情景を順に表示して、コンソールエラー（GLSLコンパイル失敗など）が無いか確認する。
// 使い方: プレビュー(4790)を起動した状態で  node scripts/verify-grade.mjs
import { chromium } from 'playwright'

const BASE = 'http://localhost:4790/seasons-gpu/'
const OUT = 'scripts/_shots'
import { mkdirSync } from 'node:fs'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 600 } })
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
// 起動ゲートを閉じる
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(800)

// 情景パネルを開いて、シェーダー情景（splat以外）のカードを順にクリック
await page.locator('button:has-text("情景")').click()
await page.waitForTimeout(400)
const labels = await page.locator('.scene-card__label').allInnerTexts()
console.log('情景カード:', labels.join(' / '))

for (let i = 0; i < labels.length; i++) {
  await page.locator('button:has-text("情景")').click().catch(() => {})
  await page.waitForTimeout(300)
  const card = page.locator('.scene-card').nth(i)
  await card.click()
  await page.waitForTimeout(1600)
  const safe = labels[i].replace(/[^\p{L}\p{N}]+/gu, '_')
  await page.screenshot({ path: `${OUT}/${String(i).padStart(2, '0')}_${safe}.png` })
  console.log(`撮影: ${labels[i]}`)
}

await browser.close()
if (errors.length) {
  console.log('\n=== コンソールエラー ===')
  errors.forEach((e) => console.log('  ' + e))
  process.exit(1)
} else {
  console.log('\nコンソールエラー無し ✓')
}
