import { chromium } from 'playwright'
import fs from 'node:fs'
const PORT = process.env.PORT || 4896
const OUT = 'scripts/_shots'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 600, height: 700 }, deviceScaleFactor: 2 })
page.on('pageerror', e => console.log('PAGEERR', e.message))
const save = (name, url) => { if (url && url.startsWith('data:image')) { fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log('saved', name) } else console.log('NO IMG', name) }

await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(()=>{})
await page.waitForTimeout(800)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')); await page.waitForTimeout(2600)
console.log('hasFigShot =', await page.evaluate(() => typeof window.__town3dFigShot))

// 各cfgを正面・3/4・横・顔ズームで
const cfgs = {
  girl: '{"skin":16767164,"hair":2366488,"iris":4865068,"outfit":"blouse","top":15789794,"bottom":3029570,"hairStyle":"bob","prop":"bag","bagCol":9072214}',
  yukata: '{"skin":16177372,"hair":2762784,"iris":5921325,"outfit":"kimono","top":3828602,"accent":9070138,"hairStyle":"short"}',
  modern: '{"skin":16177372,"hair":2762784,"iris":5921325,"outfit":"modern","top":3893052,"bottom":3092271,"hairStyle":1}',
  edo: '{"skin":16177372,"hair":2762784,"iris":5921325,"outfit":"kimono","top":3818590,"accent":9070138,"hairStyle":"hat","hat":"kasa"}',
  taisho: '{"skin":16177372,"hair":2762784,"iris":5921325,"outfit":"suit","top":3815362,"bottom":3815362,"hairStyle":"hat","hat":"fedora"}'
}
for (const [name, cfg] of Object.entries(cfgs)) {
  for (const [yaw, tag] of [[0,'front'],[0.6,'q'],[1.57,'side']]) {
    const url = await page.evaluate(({yaw,cfg}) => window.__town3dFigShot(yaw, cfg, false), {yaw,cfg})
    save(`fig_${name}_${tag}`, url)
  }
  const face = await page.evaluate(({cfg}) => window.__town3dFigShot(0, cfg, true), {cfg})
  save(`fig_${name}_face`, face)
}
console.log('done')
await browser.close()
