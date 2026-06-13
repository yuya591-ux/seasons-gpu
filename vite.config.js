import { defineConfig } from 'vite'

// GitHub Pages はリポジトリ名のサブパス配下で公開されるため base を合わせる。
// 例: https://<ユーザー名>.github.io/seasons/
export default defineConfig({
  base: '/seasons/',
})
