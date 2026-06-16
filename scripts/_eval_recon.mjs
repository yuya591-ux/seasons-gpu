// 偵察: 本番URLを開き、DOM構造・フック・初期状態を吐き出す
import { chromium } from 'playwright'
const URL = process.env.EVAL_URL || 'https://yuya591-ux.github.io/seasons/?dev=1'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
const errors = []
const logs = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 200)) })
const t0 = Date.now()
await page.goto(URL, { waitUntil: 'domcontentloaded' })
console.log('domcontentloaded at ms:', Date.now() - t0)
await page.waitForTimeout(2500)

// フックの存在確認
const hooks = await page.evaluate(() => ({
  applyScene: typeof window.__applyScene,
  sceneIds: Array.isArray(window.__sceneIds) ? window.__sceneIds : (window.__sceneIds || null),
  town3dWindow: typeof window.__town3dWindow,
  town3dLean: typeof window.__town3dLean,
  town3dSetView: typeof window.__town3dSetView,
}))
console.log('HOOKS:', JSON.stringify(hooks, null, 2))

// 初期DOMの主要要素
const dom = await page.evaluate(() => {
  const pick = (sel) => Array.from(document.querySelectorAll(sel)).slice(0, 40).map(el => ({
    tag: el.tagName.toLowerCase(),
    cls: el.className && el.className.toString ? el.className.toString().slice(0,80) : '',
    txt: (el.textContent || '').trim().slice(0, 40),
    aria: el.getAttribute('aria-label') || '',
    vis: !!(el.offsetWidth || el.offsetHeight),
  }))
  return {
    bodyClasses: document.body.className,
    gate: pick('.gate, [class*="gate"], [class*="start"]'),
    buttons: pick('button'),
    topLevel: Array.from(document.body.children).map(c => ({ tag: c.tagName.toLowerCase(), cls: (c.className||'').toString().slice(0,80), vis: !!(c.offsetWidth||c.offsetHeight) })),
    canvasCount: document.querySelectorAll('canvas').length,
  }
})
console.log('DOM:', JSON.stringify(dom, null, 2))
console.log('ERRORS:', JSON.stringify(errors, null, 2))
console.log('CONSOLE(err/warn):', JSON.stringify(logs.slice(0, 20), null, 2))
await page.screenshot({ path: 'scripts/_shots/recon-gate-390.png' })
console.log('saved recon-gate-390.png')
await browser.close()
