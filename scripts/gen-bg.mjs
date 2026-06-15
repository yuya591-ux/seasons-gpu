// 開発時専用ツール: Pollinations の Flux モデルで「窓の外の背景画像」を生成し public/bg/ に保存する。
// 「外部AI生成の組み込み方針」に厳守: Flux のみ・完全無料・APIキーなし・開発時に一度だけ生成→画像として保存。
// 本番アプリは保存済み画像を表示するだけで、実行時に外部APIを叩かない（durability＝自分がいなくなっても動く）。
//
// 使い方:
//   node scripts/gen-bg.mjs --batch scripts/bg-jobs.json     # まとめて生成（推奨）
//   node scripts/gen-bg.mjs <name> "<prompt>" [seed] [w] [h] # 単発
//
// 匿名のレート制限（約15秒に1回）に配慮し、ジョブ間に16秒の間隔を空け、混雑時(HTTP 5xx/429)は待って再試行する。

import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'bg')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 任意のトークン（無料の seed ティア等）。匿名IPのキュー制限を外せる。
// 取得元: https://enter.pollinations.ai （GitHubログイン・無料・カード不要）。
// 置き場所: 環境変数 POLLINATIONS_TOKEN か scripts/.pollinations-token（どちらも .gitignore 済み＝Gitに上げない）。
async function loadToken() {
  if (process.env.POLLINATIONS_TOKEN) return process.env.POLLINATIONS_TOKEN.trim()
  try {
    return (await readFile(join(__dirname, '.pollinations-token'), 'utf8')).trim()
  } catch {
    return null
  }
}
let TOKEN = null

async function genOne(job) {
  const { name, prompt, seed = 1, width = 1280, height = 768 } = job
  // model=flux（無料）固定。nologo は無料アカウント時のみ有効だが、付けても害はないので付ける。
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?model=flux&width=${width}&height=${height}&seed=${seed}&nologo=true` +
    (TOKEN ? `&token=${encodeURIComponent(TOKEN)}` : '')
  const headers = { accept: 'image/jpeg,image/png,*/*', referer: 'https://pollinations.ai/' }
  if (TOKEN) headers.authorization = `Bearer ${TOKEN}`
  for (let attempt = 1; attempt <= 5; attempt++) {
    process.stdout.write(`[${name}] 生成中 (試行${attempt}) … `)
    try {
      const res = await fetch(url, { headers })
      if (res.status === 402 && !TOKEN) {
        console.log('HTTP 402（匿名IPのキュー制限）。別ネットワークで実行するか、無料トークンを設定してください。')
        return false
      }
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer())
        const out = join(OUT_DIR, `${name}.jpg`)
        await writeFile(out, buf)
        console.log(`保存 ${out} (${(buf.length / 1024).toFixed(0)}KB)`)
        return true
      }
      console.log(`HTTP ${res.status} → ${attempt < 5 ? '20秒待って再試行' : '失敗'}`)
    } catch (e) {
      console.log(`通信エラー(${e.code || e.message}) → ${attempt < 5 ? '20秒待って再試行' : '失敗'}`)
    }
    if (attempt < 5) await sleep(20000)
  }
  return false
}

async function main() {
  if (typeof fetch !== 'function') {
    console.error('このスクリプトは Node 18+ (グローバル fetch) が必要です。')
    process.exit(1)
  }
  await mkdir(OUT_DIR, { recursive: true })
  TOKEN = await loadToken()
  console.log(TOKEN ? 'トークン: あり（匿名制限を回避）' : 'トークン: なし（匿名・無料。混雑時は別ネットワーク推奨）')
  const args = process.argv.slice(2)
  let jobs = []
  if (args[0] === '--batch') {
    jobs = JSON.parse(await readFile(args[1], 'utf8'))
  } else if (args.length >= 2) {
    jobs = [
      {
        name: args[0],
        prompt: args[1],
        seed: Number(args[2]) || 1,
        width: Number(args[3]) || 1280,
        height: Number(args[4]) || 768,
      },
    ]
  } else {
    console.error('引数が足りません。使い方はファイル冒頭のコメントを参照。')
    process.exit(1)
  }
  let ok = 0
  for (let i = 0; i < jobs.length; i++) {
    if (await genOne(jobs[i])) ok++
    if (i < jobs.length - 1) await sleep(16000) // レート制限（約15秒に1回）に配慮
  }
  console.log(`完了: ${ok}/${jobs.length} 枚`)
  if (ok < jobs.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
