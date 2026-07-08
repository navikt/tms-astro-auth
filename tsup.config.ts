import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['package/index.ts'],
    format: 'esm',
    dts: true,
    sourcemap: true,
    clean: true,
    metafile: true,
})
