import { defineConfig } from 'vite'
import { resolve } from 'path'
import { readFileSync } from 'fs'

const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
const version = packageJson.version

export default defineConfig({
    plugins: [
    ],
    define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
        'process.env': '{}',
        'process.platform': JSON.stringify(process.platform),
        'process.version': JSON.stringify(process.version)
    },
    build: {
        target: "es2015",
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'RsRetry', // UMD 全局变量名
            fileName: (format) => {
                return `rs-retry.${version}.${format}.js`
            },
            formats: ['umd', 'iife'] // 可以同时生成多种格式
        },
        rollupOptions: {
            // 确保外部化处理那些你不想打包进库的依赖
            output: {
                // 在 UMD 构建模式下为这些外部化的依赖提供一个全局变量
                // UMD 特定配置
                exports: 'named',
                interop: 'auto'
            }
        },
        // 清理输出目录
        emptyOutDir: true,
        // 压缩配置
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true,  // 移除 console
                drop_debugger: true  // 移除 debugger
            },

        }
    },
    // 开发服务器配置（可选）
    server: {
        port: 3000
    }
})