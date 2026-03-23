import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    build({
      // 정적 파일들은 Worker를 거치지 않고 직접 서빙
      staticPaths: ['/images/*', '/videos/*', '/static/*', '/favicon.svg', '/favicon.ico']
    }),
    devServer({
      adapter,
      entry: 'src/index.tsx'
    })
  ]
})
