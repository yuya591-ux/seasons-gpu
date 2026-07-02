// 群衆(mkCrowdPerson)の顔・腕の底上げを隔離接写で確認（正面/横顔）
import { chromium } from 'playwright'
import fs from 'node:fs'
const port = process.env.PORT || '4890'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 } })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2000)
const save = (du, name) => { if (!du) { console.log('SHOT失敗:', name); return } fs.writeFileSync(`scripts/_shots/crowd2-${name}.png`, Buffer.from(du.split(',')[1], 'base64')) }
save(await page.evaluate(() => window.__town3dCrowdShot(0xb0432e, 0.7, 0)), 'front')
save(await page.evaluate(() => window.__town3dCrowdShot(0x3a5a7a, 0.7, Math.PI / 2)), 'profile')
save(await page.evaluate(() => window.__town3dCrowdShot(0x55703f, 0.7, 0.6)), 'quarter')
await browser.close()
console.log('crowd2 done')
