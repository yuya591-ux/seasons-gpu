// 設定→「この作品について」のクレジット画面が表示されるか確認。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.getByRole('button', { name: '設定' }).click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: 'この作品について' }).click()
await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/credits.png' })
// 主要素材名が出ているか軽く検証
const hasUguisu = await page.getByText('Uguisu5707（ウグイス）').count()
const hasFlux = await page.getByText('窓の外の風景・遠景（生成画像）').count()
console.log('credits shot done; uguisu rows=', hasUguisu, 'flux rows=', hasFlux)
await browser.close()
