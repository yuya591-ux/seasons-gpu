// 2枚のPNGの平均絶対差(0-255)と最大差・差が閾値超のピクセル割合を出す。AB検証の定量化用。
// 使い方: node scripts/qa-imgdiff.mjs a.png b.png [threshold]
import fs from 'node:fs'
import zlib from 'node:zlib'

function readPNG(path) {
  const buf = fs.readFileSync(path)
  let p = 8, width = 0, height = 0, bitDepth = 0, colorType = 0
  const idat = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8)
    const data = buf.subarray(p + 8, p + 8 + len)
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9] }
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    p += 12 + len
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 4
  const stride = width * channels
  const out = Buffer.alloc(height * stride)
  const paeth = (a, b, c) => { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c }
  let rp = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++]
    for (let x = 0; x < stride; x++) {
      const rawv = raw[rp++]
      const a = x >= channels ? out[y * stride + x - channels] : 0
      const b = y > 0 ? out[(y - 1) * stride + x] : 0
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0
      let v = rawv
      if (filter === 1) v = (rawv + a) & 255
      else if (filter === 2) v = (rawv + b) & 255
      else if (filter === 3) v = (rawv + ((a + b) >> 1)) & 255
      else if (filter === 4) v = (rawv + paeth(a, b, c)) & 255
      out[y * stride + x] = v
    }
  }
  return { width, height, channels, data: out }
}

const [aPath, bPath, thrArg] = process.argv.slice(2)
const thr = parseInt(thrArg || '4', 10)
const A = readPNG(aPath), B = readPNG(bPath)
if (A.width !== B.width || A.height !== B.height) { console.log(`寸法不一致: ${A.width}x${A.height} vs ${B.width}x${B.height}`); process.exit(0) }
const n = Math.min(A.data.length, B.data.length)
let sum = 0, max = 0, over = 0, cnt = 0
const cA = A.channels, cB = B.channels
const px = A.width * A.height
for (let i = 0; i < px; i++) {
  for (let ch = 0; ch < 3; ch++) {
    const va = A.data[i * cA + ch], vb = B.data[i * cB + ch]
    const d = Math.abs(va - vb); sum += d; if (d > max) max = d; if (d > thr) over++; cnt++
  }
}
const name = aPath.split(/[\\/]/).pop().replace('before-', '').replace('.png', '')
console.log(`${name}: 平均差=${(sum / cnt).toFixed(2)} 最大差=${max} 差>${thr}のピクセル=${(over / cnt * 100).toFixed(2)}%`)
