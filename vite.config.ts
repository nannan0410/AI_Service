import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { VantResolver } from 'unplugin-vue-components/resolvers'
import { viteMockServe } from 'vite-plugin-mock'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ command }) => ({
  plugins: [
    vue(),
    Components({
      resolvers: [VantResolver()],
    }),
    viteMockServe({
      mockPath: 'mock',
      enable: command === 'serve',
      watchFiles: true,
      logger: true,
      // 排除工具模块（_utils.ts、rules.ts），避免被当作 mock 路由 bundle
      ignore: (file) => file.startsWith('_') || file === 'rules.ts',
    }),
    {
      name: 'reload-mock-on-product-data-change',
      configureServer(server) {
        const dataDir = path.resolve(__dirname, 'src/mock/products')
        const touchFile = path.resolve(__dirname, 'mock/business.ts')
        server.watcher.add(dataDir)
        server.watcher.on('change', (file) => {
          if (!file.startsWith(dataDir)) return
          const now = new Date()
          fs.utimesSync(touchFile, now, now)
        })
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@config': path.resolve(__dirname, 'config'),
    },
  },
  server: {
    port: 5172,
    strictPort: true,
    host: true,
  },
}))
