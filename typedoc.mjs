import { execSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

try {
  mkdirSync(join(dirname(fileURLToPath(import.meta.url)), 'tmp'), {
    recursive: true,
  })
  const markdownFiles = readdirSync(
    join(dirname(fileURLToPath(import.meta.url)), 'docs')
  ).filter(file => file.endsWith('.md'))
  for (const markdownFile of markdownFiles) {
    copyFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'docs', markdownFile),
      join(dirname(fileURLToPath(import.meta.url)), 'tmp', markdownFile)
    )
  }
  execSync('pnpm exec typedoc', { stdio: 'inherit' })
  for (const markdownFile of markdownFiles) {
    copyFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'tmp', markdownFile),
      join(dirname(fileURLToPath(import.meta.url)), 'docs', markdownFile)
    )
  }
  rmSync(join(dirname(fileURLToPath(import.meta.url)), 'tmp'), {
    recursive: true,
    force: true,
  })
} catch (e) {
  console.error(e)
}
