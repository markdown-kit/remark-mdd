#!/usr/bin/env node
/**
 * Package publish-parity gate.
 *
 * Builds the package tarball exactly as `npm publish` would (`pnpm pack`) and
 * asserts that every file referenced by `main`, `bin`, and the `exports` map is
 * actually included in the tarball. This catches the class of defect where
 * source on disk exposes subpaths/files that the published artifact omits
 * (e.g. an `exports` entry whose file is not in the `files` allow-list),
 * producing `ERR_PACKAGE_PATH_NOT_EXPORTED` for downstream consumers at the
 * same version number.
 *
 * Exit code 0 = the tarball ships everything it claims to export.
 * Exit code 1 = a referenced file is missing from the tarball.
 *
 * Run in CI before publish (wired as `prepublishOnly`).
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'))

/** Collect every relative file path the package promises to expose. */
function collectExpectedFiles(manifest) {
  const expected = new Set()
  const add = (value) => {
    if (typeof value !== 'string') {
      return
    }
    // Only verify concrete files, not directories or wildcard patterns.
    if (value.includes('*')) {
      return
    }
    expected.add(value.replace(/^\.\//, ''))
  }

  add(manifest.main)
  add(manifest.module)
  add(manifest.types)

  if (typeof manifest.bin === 'string') {
    add(manifest.bin)
  } else if (manifest.bin && typeof manifest.bin === 'object') {
    for (const target of Object.values(manifest.bin)) {
      add(target)
    }
  }

  const walkExports = (node) => {
    if (typeof node === 'string') {
      add(node)
      return
    }
    if (node && typeof node === 'object') {
      for (const value of Object.values(node)) {
        walkExports(value)
      }
    }
  }
  walkExports(manifest.exports)

  return [...expected]
}

function tarballEntries(tarballPath) {
  const out = execFileSync('tar', ['-tzf', tarballPath], { encoding: 'utf8' })
  // npm tarballs prefix every path with `package/`.
  return new Set(
    out
      .split('\n')
      .filter(Boolean)
      .map((line) => line.replace(/^package\//, '')),
  )
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mdd-pack-'))
try {
  const packOutput = execFileSync('pnpm', ['pack', '--pack-destination', tmpDir], {
    cwd: pkgRoot,
    encoding: 'utf8',
  }).trim()

  const tarballName = packOutput.split('\n').filter(Boolean).at(-1).trim()
  const tarballPath = path.isAbsolute(tarballName)
    ? tarballName
    : path.join(tmpDir, path.basename(tarballName))

  const shipped = tarballEntries(tarballPath)
  const expected = collectExpectedFiles(pkg)
  const missing = expected.filter((file) => !shipped.has(file))

  if (missing.length > 0) {
    console.error(
      `\n✖ ${pkg.name}@${pkg.version}: ${missing.length} referenced file(s) are NOT in the published tarball:`,
    )
    for (const file of missing) {
      console.error(`   - ${file}  (referenced by main/bin/exports but excluded by "files")`)
    }
    console.error('\nAdd them to the package.json "files" array before publishing.\n')
    process.exit(1)
  }

  console.log(
    `✔ ${pkg.name}@${pkg.version}: all ${expected.length} exported/bin/main targets are present in the tarball.`,
  )
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true })
}
