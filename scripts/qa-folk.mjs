import { chromium } from 'playwright'
import fs from 'node:fs'
const PORT = process.env.PORT || 4896
const OUT = 'scripts/_shots'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 720, height: 560 }, deviceScaleFactor: 2 })
page.on('pageerror', e => console.log('PAGEERR', e.message))
const save = (name, url) => { if (url && url.startsWith('data:image')) { fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log('saved', name) } else console.log('NO IMG', name, String(url).slice(0,40)) }

await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1&fest=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(()=>{})
await page.waitForTimeout(800)

// 夏・夕＝盆踊り開催。踊り手をfly化して空へピン留め→接写（顔・手足・浴衣・輪郭の品質）。
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset'))
await page.waitForTimeout(2800)
const n = await page.evaluate(() => window.__town3dFolkCount && window.__town3dFolkCount())
console.log('festDancers =', n)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(600)
for (const [idx, tag] of [[0,'a'],[12,'b'],[30,'c']]) {
  const url = await page.evaluate(({idx}) => { if (!window.__town3dFolkPin || idx >= window.__town3dFolkCount()) return null
    window.__town3dFolkPin(idx, 0, -300, 0, 96)
    return window.__town3dShotAt(0.6, 96.95, -310.5, 0, 96.8, -300, 22) }, {idx}) // 逆側(-z)から＝顔を正面に。全身が入るよう引き
  save(`folk_close_${tag}`, url)
}
// 祭りの広場を引きで（群れの密度・賑わい）。盆踊りは PLAZA_HOME=窓前。__town3dShotAtで俯瞰。
const wide = await page.evaluate(() => window.__town3dShotAt(0, 12, -300, 0, 4, -300, 60))
save('folk_fest_wide', wide)

// 夜の雲海＝渡し舟の舟人（既知座標 56,88.4,-315）。makeResident品質＋黒い雲が無いか。
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-rain-night'))
await page.waitForTimeout(2800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(600)
await page.evaluate(() => window.__town3dFlyPose(60, 92, -305, 0.4, -0.2)); await page.waitForTimeout(500)
const boat = await page.evaluate(() => window.__town3dShotAt(61, 90.5, -309, 56, 89.6, -315, 26))
save('folk_boat', boat)
const isle = await page.evaluate(() => window.__town3dShotAt(20, 100, -250, -10, 95, -290, 50))
save('folk_isle', isle)
console.log('done')
await browser.close()
