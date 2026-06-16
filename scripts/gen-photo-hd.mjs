// 共有エグレスIP（クラウドNAT）でPollinationsの「IPごとキュー最大1」に阻まれる環境向けの粘り強い生成。
// 402(queue full)はキューを占有せず即座に返るので、短間隔で何度も叩いて“キューが空く瞬間”を捉える。
// 成功時は生成完了までHTTP接続が保持される（約30秒ブロック）＝多重リクエストにならない。逐次1本だけ。
// 使い方: node scripts/gen-photo-hd.mjs [name1,name2,...]   （省略時はjsonの全情景）
import { writeFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'bg')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const TOKEN = (process.env.POLLINATIONS_TOKEN || (await readFile(join(__dirname, '.pollinations-token'), 'utf8').catch(() => ''))).trim()
const jobsAll = JSON.parse(await readFile(join(__dirname, 'bg-jobs-photo-hd.json'), 'utf8'))
const only = (process.argv[2] || '').split(',').filter(Boolean)
const jobs = only.length ? jobsAll.filter((j) => only.includes(j.name)) : jobsAll

const MAX_ATTEMPTS = 280  // 1情景あたりの最大試行（約3秒間隔＝最長約14分、空き待ち）
const GAP_MS = 3000

async function genOne(job) {
  const { name, prompt, seed = 1, width = 768, height = 1344 } = job
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=flux&width=${width}&height=${height}&seed=${seed}&nologo=true&token=${encodeURIComponent(TOKEN)}`
  const headers = { accept: 'image/jpeg,image/png,*/*', authorization: `Bearer ${TOKEN}` }
  let queueFull = 0
  for (let a = 1; a <= MAX_ATTEMPTS; a++) {
    try {
      const res = await fetch(url, { headers })
      const ct = res.headers.get('content-type') || ''
      if (res.ok && ct.startsWith('image')) {
        const buf = Buffer.from(await res.arrayBuffer())
        const out = join(OUT_DIR, `${name}.jpg`)
        await writeFile(out, buf)
        console.log(`[${name}] 保存 ${out} (${(buf.length / 1024).toFixed(0)}KB) ＝${queueFull}回の空き待ちで成功`)
        return true
      }
      if (res.status === 402) { queueFull++; if (a % 20 === 0) console.log(`[${name}] 空き待ち中… (試行${a}/${MAX_ATTEMPTS})`) }
      else console.log(`[${name}] HTTP ${res.status}（試行${a}）`)
    } catch (e) {
      console.log(`[${name}] 通信エラー ${e.code || e.message}（試行${a}）`)
    }
    await sleep(GAP_MS)
  }
  console.log(`[${name}] 期限内に空きを捉えられず失敗`)
  return false
}

let ok = 0
for (const job of jobs) { if (await genOne(job)) ok++ }
console.log(`完了: ${ok}/${jobs.length} 枚`)
process.exit(ok === jobs.length ? 0 : 1)
