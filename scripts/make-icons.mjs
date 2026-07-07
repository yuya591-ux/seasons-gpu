// アイコンPNG書き出し。正本は public/icon.svg（手描きSVG）。
// 通常版: icon-512 / icon-192 / apple-touch-icon(180)。
// maskable版: Androidの円形マスクで四隅が切られるため、絵(#art)を中央84%へ縮め、余白は壁色で満たす。
// ついでに確認用のプレビューシート(.qa-shots/icon-preview.png)も出す。
// 使い方: node scripts/make-icons.mjs
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const svg = readFileSync(path.join(ROOT, 'public', 'icon.svg'), 'utf8')

// maskable: 全面を壁色で敷いた上に、絵を中央へ78%縮小（安全圏=中央80%円に窓の四隅まで収まる）
const maskable = svg
  .replace('<g id="art">', '<rect width="512" height="512" fill="#241626"/>\n  <g id="art" transform="translate(56.3,56.3) scale(0.78)">')

const page404 = (msgs) => { if (msgs.length) { console.error(msgs.join('\n')); process.exit(1) } }

;(async () => {
  const browser = await chromium.launch()
  const errs = []
  const shoot = async (svgText, size, outFile) => {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
    page.on('pageerror', (e) => errs.push(String(e)))
    const html = `<!doctype html><html><body style="margin:0"><div style="width:${size}px;height:${size}px">${svgText.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</div></body></html>`
    await page.setContent(html)
    const buf = await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } })
    writeFileSync(path.join(ROOT, 'public', outFile), buf)
    await page.close()
    console.log('wrote public/' + outFile + ` (${size}x${size})`)
    return buf
  }

  await shoot(svg, 512, 'icon-512.png')
  await shoot(svg, 192, 'icon-192.png')
  await shoot(svg, 180, 'apple-touch-icon.png')
  await shoot(maskable, 512, 'icon-maskable-512.png')

  // プレビューシート: ホーム画面での見え方確認（512 / 192 / 96 / 48 + 円形マスクのmaskable）
  const b64 = (f) => readFileSync(path.join(ROOT, 'public', f)).toString('base64')
  const img = (f, s, round, circle) => `<div style="text-align:center"><img src="data:image/png;base64,${b64(f)}" width="${s}" height="${s}" style="border-radius:${circle ? '50%' : round ? Math.round(s * 0.22) + 'px' : '0'};display:block;margin:0 auto 6px"/><span style="color:#ccc;font:12px sans-serif">${f.replace('.png', '')} ${s}px${circle ? '(円形マスク)' : ''}</span></div>`
  const sheet = `<!doctype html><html><body style="margin:0;background:#3a3f4a;padding:28px;display:flex;gap:34px;align-items:flex-end;width:1000px">${img('icon-512.png', 200, true)}${img('icon-192.png', 120, true)}${img('icon-192.png', 96, true)}${img('icon-192.png', 48, true)}${img('icon-maskable-512.png', 120, false, true)}</body></html>`
  const page = await browser.newPage({ viewport: { width: 1060, height: 320 } })
  await page.setContent(sheet)
  mkdirSync(path.join(ROOT, '.qa-shots'), { recursive: true })
  await page.screenshot({ path: path.join(ROOT, '.qa-shots', 'icon-preview.png'), fullPage: true })
  console.log('wrote .qa-shots/icon-preview.png')
  await browser.close()
  page404(errs)
})().catch((e) => { console.error(e); process.exit(1) })
