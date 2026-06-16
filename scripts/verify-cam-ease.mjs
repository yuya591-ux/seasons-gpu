// 窓あけ／乗り出しカメラ演出の ease-in-out を数値で検証する。
// ガラス(.town3d-glass)の translateX% から窓あけ進行 wo を、窓台(.town3d-sill)の translateY% から
// 乗り出し進行 lean を毎フレーム読み取り、フレーム間の増分が「小→大→小」のS字（両端やわらか）に
// なっているかを確認する。線形やexp追従(ease-out)ではこの形にならない。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const id = process.argv[2] || 'kitaterao-window-3d'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 1 })
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
await page.waitForTimeout(1800)

// 指定の操作を行い、durMs の間、対象要素の transform から進行値を毎フレーム採取する。
async function sample(trigger, sel, parse, durMs) {
  return await page.evaluate(async ([trig, sel, parseSrc, durMs]) => {
    const parse = eval(parseSrc)
    const fn = new Function(trig)
    fn()
    const el = document.querySelector(sel)
    const out = []
    const t0 = performance.now()
    return await new Promise((resolve) => {
      function step() {
        const now = performance.now() - t0
        out.push([Math.round(now), parse(el && el.style.transform || '')])
        if (now >= durMs) return resolve(out)
        requestAnimationFrame(step)
      }
      step()
    })
  }, [trigger, sel, parse.toString(), durMs])
}

const woParse = `(s)=>{const m=/translateX\\(([-0-9.]+)%\\)/.exec(s);return m?+(+m[1]/96).toFixed(4):0}`
const leanParse = `(s)=>{const m=/translateY\\(([-0-9.]+)%\\)/.exec(s);return m?+(+m[1]/130).toFixed(4):0}`

// 増分の山が中央付近にあり、最初と最後の増分が小さいか＝ease-in-out かを判定して表示する。
function report(name, series) {
  // 重複時刻を間引き、値が動いた点だけ残す
  const uniq = []
  for (const [t, v] of series) { if (!uniq.length || uniq[uniq.length - 1][1] !== v) uniq.push([t, v]) }
  const vals = uniq.map((p) => p[1])
  const deltas = []
  for (let i = 1; i < vals.length; i++) deltas.push(+(vals[i] - vals[i - 1]).toFixed(4))
  // 開く/戻る両対応で増分の「大きさ」で速度の山を見る（戻りは増分が負になるため絶対値で評価）。
  const mags = deltas.map((d) => Math.abs(d))
  const maxD = Math.max(...mags)
  const peakIdx = mags.indexOf(maxD)
  const firstD = mags[0] ?? 0
  const lastD = mags[mags.length - 1] ?? 0
  const startSoft = firstD <= maxD * 0.5     // 出だしがやわらか
  const stopSoft = lastD <= maxD * 0.5       // 止まり際がやわらか
  const peakMid = peakIdx > 0 && peakIdx < deltas.length - 1 // 速度の山が中央
  console.log(`\n■ ${name}`)
  console.log('  進行(0→1):', vals.map((v) => v.toFixed(2)).join(' '))
  console.log('  増分:', deltas.map((d) => d.toFixed(3)).join(' '))
  console.log(`  最大増分=${maxD.toFixed(3)} 山の位置=${peakIdx + 1}/${deltas.length} 初増分=${firstD.toFixed(3)} 末増分=${lastD.toFixed(3)}`)
  console.log(`  判定: 出だしやわらか=${startSoft} 止まりやわらか=${stopSoft} 山が中央=${peakMid} => ${startSoft && stopSoft && peakMid ? 'ease-in-out OK' : '要確認'}`)
  return startSoft && stopSoft && peakMid
}

// 1) 窓をあける
const openS = await sample(`window.__town3dWindow(true)`, '.town3d-glass', eval(woParse), 1700)
const okOpen = report('窓をあける（wo）', openS)
// もどす
await page.evaluate(() => window.__town3dWindow(false))
await page.waitForTimeout(1700)
// 2) 身を乗り出す
const leanS = await sample(`window.__town3dLean(true)`, '.town3d-sill', eval(leanParse), 2100)
const okLean = report('身を乗り出す（lean）', leanS)
// 3) 戻る（逆再生もS字か）
const backS = await sample(`window.__town3dLean(false)`, '.town3d-sill', eval(leanParse), 2100)
const okBack = report('もどる（lean→0 逆再生）', backS)

await browser.close()
console.log(`\n総合: 窓=${okOpen ? 'OK' : 'NG'} 乗り出し=${okLean ? 'OK' : 'NG'} 戻り=${okBack ? 'OK' : 'NG'}`)
