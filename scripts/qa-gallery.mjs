// 公開ギャラリー（?dev=1なし）に隠したシーンが出ていないか確認＋公開数を数える。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/`, { waitUntil: 'networkidle' }) // dev=1なし＝公開のみ
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.getByRole('button', { name: '情景' }).click()
await page.waitForTimeout(600)
const cards = await page.locator('.scene-card').count()
const labels = await page.locator('.scene-card__label').allTextContents()
const hidden = ['夏の夕暮れ、高台の下町', '冬の雪の夜、高台の下町', '夏の雨の夜、高台の下町', '夏の晴れ、真昼', '朝の谷戸、鶴見・獅子ヶ谷']
const leaked = hidden.filter((h) => labels.includes(h))
console.log('公開カード数=', cards)
console.log('隠したのに出ている=', leaked.length ? leaked.join(' / ') : 'なし(OK)')
await page.screenshot({ path: 'scripts/_shots/gallery-public.png', fullPage: true })
await browser.close()
