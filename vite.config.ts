import fs from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import electron from 'vite-plugin-electron/simple'
// ⚠️ tsconfig.node.json 的 module 是 NodeNext，从这个版本起「在 ESM 里 import JSON」
// 必须显式带 import attribute，否则 TS1543。Vite 自身用 esbuild 加载本文件，
// 该语法同样被支持，行为与原来的默认导入完全一致。
import pkg from './package.json' with { type: 'json' }
import { jsonX } from 'vite-plugin-jsonx';
import { resolve } from 'node:path'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  fs.rmSync('dist-electron', { recursive: true, force: true })

  const isServe = command === 'serve'
  const isBuild = command === 'build'
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG

  return {
    optimizeDeps: {
      include: ['electron-store']
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      }
    },
    css: {
      preprocessorOptions: {
        // 消除：Deprecation Warning [legacy-js-api]: The legacy JS API is deprecated and will be removed in Dart Sass 2.0.0.
        scss: {
          api: 'modern-compiler',
          silenceDeprecations: ['legacy-js-api'],
        }
      }
    },
    plugins: [
      vue(),
      vueJsx(),
      jsonX(),
      electron({
        main: {
          // Shortcut of `build.lib.entry`
          entry: 'electron/main/index.ts',
          onstart({ startup }) {
            if (process.env.VSCODE_DEBUG) {
              console.log(/* For `.vscode/.debug.script.mjs` */'[startup] Electron App')
            } else {
              startup()
            }
          },
          vite: {
            build: {
              sourcemap,
              minify: isBuild,
              outDir: 'dist-electron/main',
              rollupOptions: {
                // Some third-party Node.js libraries may not be built correctly by Vite, especially `C/C++` addons, 
                // we can use `external` to exclude them to ensure they work correctly.
                // Others need to put them in `dependencies` to ensure they are collected into `app.asar` after the app is built.
                // Of course, this is not absolute, just this way is relatively simple. :)
                external: [...Object.keys('dependencies' in pkg ? pkg.dependencies : {}), ],
              },
            },
          },
        },
        preload: {
          // Shortcut of `build.rollupOptions.input`.
          // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
          input: 'electron/preload/index.ts',
          vite: {
            build: {
              sourcemap: sourcemap ? 'inline' : undefined, // #332
              minify: isBuild,
              outDir: 'dist-electron/preload',
              rollupOptions: {
                external: Object.keys('dependencies' in pkg ? pkg.dependencies : {}),
              },
            },
          },
        },
      }),
    ],
    server: process.env.VSCODE_DEBUG && (() => {
      const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL)
      return {
        host: url.hostname,
        port: +url.port,
      }
    })(),
    clearScreen: false,
  }
})
