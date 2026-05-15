import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const tmpDir = join(root, 'tmp')
const docsDir = join(root, 'docs')
const markdownFiles = readdirSync(docsDir).filter(file => file.endsWith('.md'))

mkdirSync(tmpDir, { recursive: true })
for (const markdownFile of markdownFiles) {
  copyFileSync(join(docsDir, markdownFile), join(tmpDir, markdownFile))
}

try {
  // execFileSync inherits stdio and throws on non-zero exit, propagating the
  // typedoc exit status to this wrapper's parent (pnpm). Wrapping in
  // try/finally ensures the docs/*.md restoration runs even on failure.
  execFileSync('pnpm', ['exec', 'typedoc', ...process.argv.slice(2)], {
    stdio: 'inherit',
  })
} finally {
  for (const markdownFile of markdownFiles) {
    copyFileSync(join(tmpDir, markdownFile), join(docsDir, markdownFile))
  }
  rmSync(tmpDir, { force: true, recursive: true })
}
