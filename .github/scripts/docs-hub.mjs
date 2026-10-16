#!/usr/bin/env node
// Exit codes: 0 = rebuilt, 1 = rebuilt with ownership failures, 2 = fatal.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const NUMERIC_IDENTIFIER = '0|[1-9]\\d*'
const PRERELEASE_IDENTIFIER = '(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)'
const BUILD_IDENTIFIER = '[0-9A-Za-z-]+'
const VERSION_PATTERN = new RegExp(
  `^v?(${NUMERIC_IDENTIFIER})\\.(${NUMERIC_IDENTIFIER})\\.(${NUMERIC_IDENTIFIER})` +
    `(?:-(${PRERELEASE_IDENTIFIER}(?:\\.${PRERELEASE_IDENTIFIER})*))?` +
    `(?:\\+${BUILD_IDENTIFIER}(?:\\.${BUILD_IDENTIFIER})*)?$`,
)
const REGISTRY_KEYS = [
  'path',
  'source',
  'mode',
  'versionsUrl',
  'unnamed',
  'latest',
  'indexKey',
  'topFiles',
]
const RELEASE_ONLY_KEYS = ['versionsUrl', 'unnamed', 'latest', 'indexKey']
const DEFAULT_ROOT = 'site/raw'
const DEFAULT_REGISTRY = '.docs-hub/registry.yaml'
const IMAGES_DIR = 'images'
const RESERVED_NAMES = new Set(['index.json', 'versions.json', 'meta.json', '.meta.json', IMAGES_DIR])
const PATH_SUB_DELIMITERS = /%(2B|2C|3A|3B|3D|40|24|26)/gi

export class FatalError extends Error {}

function urlPath(segments) {
  return segments
    .filter((segment) => segment !== '')
    .flatMap((segment) => segment.split('/'))
    .map((segment) =>
      encodeURIComponent(segment).replace(PATH_SUB_DELIMITERS, (encoded) =>
        decodeURIComponent(encoded),
      ),
    )
    .join('/')
}

export function areaSlug(areaPath) {
  return areaPath.split('/').join('-')
}

export function flatImageName(areaPath, name, relativePath) {
  const parts = [areaSlug(areaPath)]
  if (name) parts.push(name)
  parts.push(...relativePath.split('/'))
  return parts.join('-')
}

function isMarkdownName(name) {
  return path.posix.extname(name).toLowerCase() === '.md'
}

function parseVersion(version) {
  const match = VERSION_PATTERN.exec(version)
  if (!match) throw new FatalError(`"${version}" is not a semantic version`)
  return {
    major: BigInt(match[1]),
    minor: BigInt(match[2]),
    patch: BigInt(match[3]),
    pre: match[4] ?? null,
  }
}

function compareSemver(left, right) {
  const a = parseVersion(left)
  const b = parseVersion(right)
  for (const part of ['major', 'minor', 'patch']) {
    if (a[part] !== b[part]) return a[part] < b[part] ? -1 : 1
  }
  if (a.pre === b.pre) return 0
  if (a.pre === null) return 1
  if (b.pre === null) return -1

  const aParts = a.pre.split('.')
  const bParts = b.pre.split('.')
  for (let index = 0; index < Math.max(aParts.length, bParts.length); index++) {
    const x = aParts[index]
    const y = bParts[index]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const xNumeric = /^\d+$/.test(x)
    const yNumeric = /^\d+$/.test(y)
    if (xNumeric && yNumeric) {
      if (BigInt(x) !== BigInt(y)) return BigInt(x) < BigInt(y) ? -1 : 1
    } else if (xNumeric) {
      return -1
    } else if (yNumeric) {
      return 1
    } else if (x !== y) {
      return x < y ? -1 : 1
    }
  }
  return 0
}

function parseArgs(argv) {
  const options = { docs: null, root: DEFAULT_ROOT, registry: DEFAULT_REGISTRY, urlBase: null }
  const flags = {
    '--docs': 'docs',
    '--root': 'root',
    '--registry': 'registry',
    '--url-base': 'urlBase',
  }

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index]
    const [flag, inline] = token.includes('=') ? token.split(/=(.*)/s, 2) : [token, null]
    const key = flags[flag]
    if (!key) throw new FatalError(`unknown argument "${token}"`)
    const value = inline ?? argv[++index]
    if (value === undefined) throw new FatalError(`missing value for "${flag}"`)
    options[key] = value
  }

  if (!options.docs) throw new FatalError('--docs is required')
  if (!options.urlBase) throw new FatalError('--url-base is required')
  const segments = options.root.split('/')
  if (options.root === '' || segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new FatalError(`--root must be a normalized folder inside the docs checkout, got "${options.root}"`)
  }
  if (!fs.existsSync(options.docs) || !fs.statSync(options.docs).isDirectory()) {
    throw new FatalError(`docs checkout "${options.docs}" is not a directory`)
  }
  return options
}

export function parseRegistry(text) {
  if (text.trim() === '' || text.trim() === 'null') return []
  let document
  try {
    document = JSON.parse(text)
  } catch (error) {
    throw new FatalError(`registry: invalid JSON (${error.message}); is registry.yaml valid YAML?`)
  }
  if (document === null) return []
  if (!Array.isArray(document)) {
    throw new FatalError(`registry must be a YAML list of entries, got ${JSON.stringify(document)}`)
  }
  const raws = document

  const entries = []
  const seen = new Set()

  for (const [index, raw] of raws.entries()) {
    const entryNumber = index + 1
    const label =
      raw && typeof raw === 'object' && !Array.isArray(raw) && typeof raw.path === 'string' && raw.path !== ''
        ? `registry entry ${entryNumber} (path "${raw.path}")`
        : `registry entry ${entryNumber}`
    const fail = (message) => {
      throw new FatalError(`${label}: ${message}`)
    }

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('entry must be an object')
    for (const key of Object.keys(raw)) {
      if (!REGISTRY_KEYS.includes(key)) fail(`unknown key "${key}"`)
    }

    const area = raw.path
    if (area === undefined || area === null || area === '') fail('missing "path"')
    if (typeof area !== 'string') fail(`"path" must be a non-empty string, got ${JSON.stringify(area)}; quote the value in registry.yaml`)
    if (
      path.posix.isAbsolute(area) ||
      area.endsWith('/') ||
      area.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
    ) {
      fail(`"path" must be a relative Area path, got "${area}"`)
    }
    if (area === IMAGES_DIR || area.startsWith(`${IMAGES_DIR}/`)) {
      fail(`"path" must not be the hub-owned "${IMAGES_DIR}" folder or inside it, got "${area}"`)
    }
    if (typeof raw.source !== 'string' || !/^[^/\s]+\/[^/\s]+$/.test(raw.source)) {
      fail(`"source" must be an "org/repo" string, got ${JSON.stringify(raw.source)}${typeof raw.source === 'number' ? '; quote the value in registry.yaml' : ''}`)
    }
    if (raw.mode !== 'release' && raw.mode !== 'mirror') {
      fail(`"mode" must be "release" or "mirror", got ${JSON.stringify(raw.mode)}${typeof raw.mode === 'number' ? '; quote the value in registry.yaml' : ''}`)
    }
    if (seen.has(area)) fail(`duplicate path "${area}"`)
    seen.add(area)

    const entry = { path: area, source: raw.source, mode: raw.mode, slug: areaSlug(area) }

    if (entry.mode === 'mirror') {
      for (const key of RELEASE_ONLY_KEYS) {
        if (key in raw) fail(`"${key}" is only valid for release Areas`)
      }
    } else {
      entry.versionsUrl = raw.versionsUrl ?? 'README.md'
      if (typeof entry.versionsUrl !== 'string' || entry.versionsUrl === '') {
        fail(`"versionsUrl" must be a non-empty string${typeof raw.versionsUrl === 'number' ? `, got ${JSON.stringify(raw.versionsUrl)}; quote the value in registry.yaml` : ''}`)
      }
      if (
        path.posix.isAbsolute(entry.versionsUrl) ||
        entry.versionsUrl.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
      ) {
        fail(`"versionsUrl" must be a relative path inside the Version folder, got "${entry.versionsUrl}"`)
      }
      entry.unnamed = raw.unnamed ?? false
      if (typeof entry.unnamed !== 'boolean') fail('"unnamed" must be a boolean')
      if (entry.unnamed) {
        entry.latest = raw.latest ?? 'latest'
        if (typeof entry.latest !== 'string' || entry.latest === '') {
          fail(`"latest" must be a non-empty string${typeof raw.latest === 'number' ? `, got ${JSON.stringify(raw.latest)}; quote the value in registry.yaml` : ''}`)
        }
        if (entry.latest.includes('/') || entry.latest === '.' || entry.latest === '..') {
          fail(`"latest" must be one folder name inside the Area, got "${entry.latest}"`)
        }
        if (VERSION_PATTERN.test(entry.latest) || entry.latest === 'versions.json' || entry.latest === 'meta.json') {
          fail(`"latest" must not be a version or a derived file name, got "${entry.latest}"`)
        }
        if ('indexKey' in raw) fail('"indexKey" is only valid for named release Areas')
      } else {
        if ('latest' in raw) fail('"latest" is only valid for unnamed release Areas')
        entry.indexKey = raw.indexKey ?? area.split('/').at(-1)
        if (typeof entry.indexKey !== 'string' || entry.indexKey === '') {
          fail(`"indexKey" must be a non-empty string${typeof raw.indexKey === 'number' ? `, got ${JSON.stringify(raw.indexKey)}; quote the value in registry.yaml` : ''}`)
        }
      }
    }

    if ('topFiles' in raw) {
      if (!Array.isArray(raw.topFiles)) {
        fail(`"topFiles" must be a list of file names${typeof raw.topFiles === 'string' ? `, got ${JSON.stringify(raw.topFiles)}; write it as a YAML list` : ''}`)
      }
      entry.topFiles = []
      for (const [fileIndex, file] of raw.topFiles.entries()) {
        if (typeof file !== 'string' || file.trim() === '') {
          fail(`"topFiles[${fileIndex}]" must be a non-empty string${typeof file === 'number' ? `, got ${JSON.stringify(file)}; quote the value in registry.yaml` : ''}`)
        }
        entry.topFiles.push(file.trim())
      }
      const hubFiles = ['meta.json', '.meta.json']
      if (entry.mode === 'release') {
        hubFiles.push(...(entry.unnamed ? ['versions.json', entry.latest] : ['index.json']))
      }
      for (const file of entry.topFiles) {
        if (file.includes('/')) {
          fail(`"topFiles" must be file names at the Area root, got "${file}"`)
        }
        if (hubFiles.includes(file)) {
          fail(`"topFiles" names "${file}", which the hub reads or writes at the Area root`)
        }
      }
    } else {
      entry.topFiles = []
    }

    entries.push(entry)
  }

  if (entries.length === 0) return entries
  return entries
}

function ownerOf(entries, relPath) {
  let owner = null
  for (const entry of entries) {
    if (relPath === entry.path || relPath.startsWith(`${entry.path}/`)) {
      if (!owner || entry.path.length > owner.path.length) owner = entry
    }
  }
  return owner
}

function parentOf(relPath) {
  const segments = relPath.split('/')
  segments.pop()
  return segments.join('/')
}

function lstat(abs) {
  try {
    return fs.lstatSync(abs)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

function relativeFiles(dir, prefix = '') {
  const files = []
  for (const name of fs.readdirSync(dir).sort()) {
    const abs = path.join(dir, name)
    const rel = prefix ? `${prefix}/${name}` : name
    const stats = lstat(abs)
    if (!stats) continue
    if (stats.isDirectory()) files.push(...relativeFiles(abs, rel))
    else if (stats.isFile()) files.push(rel)
  }
  return files
}

function isDirectory(relPath, options) {
  return lstat(path.join(options.docs, options.root, relPath))?.isDirectory() ?? false
}

function discover(entries, options) {
  const failures = []
  const failedDirs = new Set()
  const versions = []
  const mirrors = []

  const fail = (relPath, reason) => {
    failures.push({ path: relPath, reason })
    failedDirs.add(parentOf(relPath))
  }

  const rootAbs = path.join(options.docs, options.root)
  for (const rel of relativeFiles(rootAbs)) {
    const base = path.posix.basename(rel)
    if (base !== 'meta.json' && base !== '.meta.json') continue

    let metadata
    try {
      metadata = JSON.parse(fs.readFileSync(path.join(rootAbs, rel), 'utf8'))
    } catch (error) {
      fail(rel, `invalid JSON (${error.message})`)
      continue
    }
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      fail(rel, 'metadata must be a JSON object')
      continue
    }

    const folder = path.posix.dirname(rel)
    if (base === '.meta.json') {
      const owner = validateMirror(rel, folder, metadata, entries, fail)
      if (owner) mirrors.push({ rel, dir: folder, metadata, entry: owner })
      continue
    }

    const area = metadata.area
    const registered = typeof area === 'string' && entries.some((entry) => entry.path === area)
    if (!VERSION_PATTERN.test(path.posix.basename(folder)) && !registered) {
      continue
    }
    const owner = validateVersion(rel, folder, metadata, entries, fail)
    if (owner) versions.push({ rel, dir: folder, metadata, entry: owner })
  }

  const usable = (item) => !isUnderFailed(item.dir, failedDirs)
  return { failures, failedDirs, versions: versions.filter(usable), mirrors: mirrors.filter(usable) }
}

function validateMirror(rel, folder, metadata, entries, fail) {
  const area = metadata.area
  if (typeof area !== 'string' || area === '') {
    fail(rel, 'missing "area"')
    return null
  }
  if (typeof metadata.source !== 'string' || metadata.source === '') {
    fail(rel, 'missing "source"')
    return null
  }
  const owner = ownerOf(entries, folder)
  if (!owner || owner.path !== area || folder !== area) {
    fail(rel, `path "${folder}" is not the registered Area "${area}"`)
    return null
  }
  if (owner.mode !== 'mirror') {
    fail(rel, `Area "${area}" is a release Area in the Registry`)
    return null
  }
  if (owner.source !== metadata.source) {
    fail(rel, `source "${metadata.source}" does not match the Registry source "${owner.source}"`)
    return null
  }
  return owner
}

function isSafeName(name) {
  return !name.includes('/') && name !== '.' && name !== '..' && !RESERVED_NAMES.has(name)
}

function validateVersion(rel, folder, metadata, entries, fail) {
  for (const field of ['source', 'area', 'version', 'date']) {
    if (typeof metadata[field] !== 'string' || metadata[field] === '') {
      fail(rel, `missing "${field}"`)
      return null
    }
  }
  if (metadata.name !== undefined && (typeof metadata.name !== 'string' || metadata.name === '')) {
    fail(rel, '"name" must be a non-empty string when present')
    return null
  }
  if (metadata.name !== undefined && !isSafeName(metadata.name)) {
    fail(rel, `"name" must be one path segment and not a hub-reserved name, got "${metadata.name}"`)
    return null
  }
  if (!VERSION_PATTERN.test(metadata.version)) {
    fail(rel, `"${metadata.version}" is not a semantic version`)
    return null
  }
  const owner = ownerOf(entries, folder)
  if (!owner) {
    fail(rel, `unknown Area "${metadata.area}"`)
    return null
  }
  if (owner.path !== metadata.area) {
    fail(rel, `path "${folder}" is not owned by the Area "${metadata.area}"`)
    return null
  }
  if (owner.mode !== 'release') {
    fail(rel, `Area "${metadata.area}" is a Mirror Area in the Registry`)
    return null
  }
  if (owner.source !== metadata.source) {
    fail(rel, `source "${metadata.source}" does not match the Registry source "${owner.source}"`)
    return null
  }
  if (owner.unnamed) {
    if (metadata.name !== undefined) {
      fail(rel, `Area "${owner.path}" is unnamed, so "name" must be absent`)
      return null
    }
  } else if (metadata.name === undefined) {
    fail(rel, 'missing "name"')
    return null
  }

  const expected = owner.unnamed
    ? `${owner.path}/${metadata.version}`
    : `${owner.path}/${metadata.name}/${metadata.version}`
  if (folder !== expected) {
    fail(rel, `path "${folder}" does not match "${expected}"`)
    return null
  }
  return owner
}

function releasePlan(entry, folders, options, failedDirs) {
  const sorted = [...folders].sort((a, b) =>
    compareSemver(b.metadata.version, a.metadata.version),
  )
  const newest = sorted[0]
  const name = entry.unnamed ? '' : newest.metadata.name
  const nameDir = name ? `${entry.path}/${name}` : entry.path

  return {
    entry,
    name,
    newest,
    dir: nameDir,
    versionDir: newest.dir,
    versionDirs: sorted.map((folder) => folder.dir),
    failedDirs: [...failedDirs].filter(
      (dir) => parentOf(dir) === nameDir && VERSION_PATTERN.test(path.posix.basename(dir)),
    ),
    target: entry.unnamed ? `${entry.path}/${entry.latest}` : nameDir,
    versionsFile: `${nameDir}/versions.json`,
    versions: sorted.map((folder) => ({
      version: folder.metadata.version,
      date: folder.metadata.date,
      url: `${options.urlBase}/${urlPath([entry.path, entry.unnamed ? '' : name, folder.metadata.version, entry.versionsUrl])}`,
    })),
  }
}

const CODE_OR_LINK =
  /(```[\s\S]*?```|~~~[\s\S]*?~~~|(`+)(?!`)[^\n]*?(?<!`)\2(?!`))|(\]\(|\]:\s+|\b(?:src|href)=["'])(?:\.\/)?images\/([^\s)"'#?]+)/g

export function rewriteImageLinks(content, imagesDir, expected, entry, name) {
  return content.replace(CODE_OR_LINK, (match, code, run, prefix, relPath) => {
    if (code !== undefined) return match
    if (relPath.split('/').some((segment) => segment === '' || segment === '..')) return match
    const flatName = flatImageName(entry.path, name, relPath)
    if (expected.get(flatName) !== path.join(imagesDir, relPath)) return match
    return `${prefix}./images/${flatName}`
  })
}

function topLevelFileNames(versionDirs, options) {
  const names = new Set()
  for (const versionDir of versionDirs) {
    const abs = path.join(options.docs, options.root, versionDir)
    for (const name of fs.readdirSync(abs)) {
      if (name === 'meta.json') continue
      if (lstat(path.join(abs, name))?.isFile()) names.add(name)
    }
  }
  return names
}

function failedNamesByFolder(entries, failedDirs) {
  const names = new Map()
  for (const dir of failedDirs) {
    if (!VERSION_PATTERN.test(path.posix.basename(dir))) continue
    const entry = ownerOf(entries, dir)
    if (!entry || entry.mode !== 'release') continue
    const nameDir = parentOf(dir)
    const inArea = entry.unnamed ? nameDir === entry.path : parentOf(nameDir) === entry.path
    if (!inArea) continue
    if (!entry.unnamed && !isSafeName(path.posix.basename(nameDir))) continue
    if (!names.has(nameDir)) names.set(nameDir, { entry, dirs: [] })
    names.get(nameDir).dirs.push(dir)
  }
  return names
}

function retireName(retirement, options) {
  const rootAbs = path.join(options.docs, options.root)
  const versions = lstat(path.join(rootAbs, retirement.versionsFile))
  if (versions && !versions.isDirectory()) fs.rmSync(path.join(rootAbs, retirement.versionsFile))

  const targetAbs = path.join(rootAbs, retirement.target)
  if (!lstat(targetAbs)?.isDirectory()) return
  const leftovers = topLevelFileNames(retirement.dirs, options)
  for (const name of fs.readdirSync(targetAbs)) {
    const abs = path.join(targetAbs, name)
    if (lstat(abs)?.isFile() && leftovers.has(name)) fs.rmSync(abs)
  }
}

function applyLatest(plan, options, expected) {
  const sourceAbs = path.join(options.docs, options.root, plan.versionDir)
  const imagesAbs = path.join(sourceAbs, IMAGES_DIR)
  const targetAbs = path.join(options.docs, options.root, plan.target)
  if (lstat(targetAbs)?.isSymbolicLink()) fs.rmSync(targetAbs)
  fs.mkdirSync(targetAbs, { recursive: true })

  const copies = []
  for (const name of fs.readdirSync(sourceAbs).sort()) {
    const abs = path.join(sourceAbs, name)
    if (!lstat(abs)?.isFile() || name === 'meta.json') continue
    const bytes = fs.readFileSync(abs)
    copies.push({
      name,
      content: isMarkdownName(name)
        ? rewriteImageLinks(bytes.toString('utf8'), imagesAbs, expected, plan.entry, plan.name)
        : bytes,
    })
  }

  const previous = topLevelFileNames([...plan.versionDirs, ...plan.failedDirs], options)

  const keep = new Set([...copies.map((copy) => copy.name), 'versions.json'])
  for (const name of fs.readdirSync(targetAbs)) {
    const abs = path.join(targetAbs, name)
    if (!lstat(abs)?.isFile() || keep.has(name) || !previous.has(name)) continue
    fs.rmSync(abs)
  }
  for (const copy of copies) writeOwned(path.join(targetAbs, copy.name), copy.content)

  return copies
}

function writeOwned(absPath, content) {
  if (lstat(absPath)?.isSymbolicLink()) fs.rmSync(absPath)
  fs.writeFileSync(absPath, content)
}

function writeJson(absPath, value) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true })
  writeOwned(absPath, `${JSON.stringify(value, null, 2)}\n`)
}

function applyReleases(plans, entries, options, expected, areasWithFolders) {
  const managed = []
  const derivedFiles = []
  const blocked = []

  for (const plan of plans) {
    const copies = applyLatest(plan, options, expected)
    writeJson(path.join(options.docs, options.root, plan.versionsFile), plan.versions)
    derivedFiles.push(plan.versionsFile)
    managed.push({
      entry: plan.entry,
      name: plan.name,
      version: plan.newest.metadata.version,
      versionDir: plan.versionDir,
      dir: plan.dir,
      latestDir: plan.target,
      files: copies.map((copy) => copy.name),
    })
  }

  for (const entry of entries) {
    if (entry.mode !== 'release' || entry.unnamed) continue
    const named = managed
      .filter((item) => item.entry === entry && item.name)
      .sort((a, b) => (a.name < b.name ? -1 : 1))
    if (named.length === 0 && !areasWithFolders.has(entry)) continue

    const indexFile = `${entry.path}/index.json`
    const indexAbs = path.join(options.docs, options.root, indexFile)
    if (lstat(indexAbs)?.isDirectory()) {
      blocked.push({ path: indexFile, reason: `"${indexFile}" is a folder, so the index cannot be written` })
      continue
    }
    const value = {
      [entry.indexKey]: named.map((item) => ({
        name: item.name,
        version: item.version,
        files: [
          ...item.files.filter((name) => name === 'README.md'),
          ...item.files.filter((name) => isMarkdownName(name) && name !== 'README.md'),
        ].map((name) => ({ name, url: `${options.urlBase}/${urlPath([entry.path, item.name, name])}` })),
      })),
    }
    writeJson(indexAbs, value)
    derivedFiles.push(indexFile)
  }

  return { managed, derivedFiles, blocked }
}

function imageOwners(entries, presentNames, fileName) {
  const owners = []
  for (const entry of entries) {
    if (!fileName.startsWith(`${entry.slug}-`)) continue
    if (entry.mode === 'release' && !entry.unnamed) {
      for (const name of presentNames.get(entry) ?? []) {
        if (fileName.startsWith(`${entry.slug}-${name}-`)) owners.push({ entry, name })
      }
    } else {
      owners.push({ entry, name: '' })
    }
  }
  return owners
}

function collectPresentNames(entries, options) {
  const presentNames = new Map()
  for (const entry of entries) {
    if (entry.mode !== 'release' || entry.unnamed) continue
    const areaAbs = path.join(options.docs, options.root, entry.path)
    if (!lstat(areaAbs)?.isDirectory()) continue
    presentNames.set(
      entry,
      fs.readdirSync(areaAbs).filter(
        (name) =>
          lstat(path.join(areaAbs, name))?.isDirectory() &&
          ownerOf(entries, `${entry.path}/${name}`) === entry,
      ),
    )
  }
  return presentNames
}

function ownerDir(owner) {
  return owner.name ? `${owner.entry.path}/${owner.name}` : owner.entry.path
}

function expectedImages(entries, sources, options, presentNames, willRebuild, failedDirs) {
  const claimed = new Map()

  for (const { dir, entry, name } of sources) {
    const imagesAbs = path.join(options.docs, options.root, dir, IMAGES_DIR)
    if (!lstat(imagesAbs)?.isDirectory()) continue
    for (const rel of relativeFiles(imagesAbs)) {
      const sourceRel = path.posix.join(dir, IMAGES_DIR, rel)
      const owner = ownerOf(entries, sourceRel)
      if (owner && owner !== entry) continue
      if (failedDirs && isUnderFailed(sourceRel, failedDirs)) continue
      const flatName = flatImageName(entry.path, name, rel)
      const claims = claimed.get(flatName) ?? []
      claims.push({ file: path.join(imagesAbs, rel), rel: path.posix.join(dir, IMAGES_DIR, rel), entry, name })
      claimed.set(flatName, claims)
    }
  }

  const isRebuilt = (owner) =>
    owner.name
      ? (willRebuild?.names.get(owner.entry) ?? new Set()).has(owner.name)
      : willRebuild?.areas.has(owner.entry) ?? false
  const expected = new Map()
  const collisions = new Map()
  const ambiguous = new Map()
  for (const [flatName, claims] of claimed) {
    if (claims.length > 1) {
      collisions.set(flatName, new Set(claims.map((claim) => claim.rel)))
      continue
    }
    const claim = claims[0]
    const owners = imageOwners(entries, presentNames, flatName)
    const isClaimant = (owner) => owner.entry === claim.entry && owner.name === claim.name
    if (!owners.some(isClaimant)) {
      ambiguous.set(flatName, {
        rel: claim.rel,
        owners: [ownerDir(claim)].sort(),
      })
      continue
    }
    const outsiders = owners.filter((owner) => !isClaimant(owner) && !isRebuilt(owner))
    if (outsiders.length) {
      ambiguous.set(flatName, {
        rel: claim.rel,
        owners: owners.map(ownerDir).sort(),
      })
      continue
    }
    expected.set(flatName, claim.file)
  }
  return { expected, collisions, ambiguous }
}

function applyImages(entries, state, options, images, presentNames) {
  const { expected, collisions, ambiguous } = images
  const imagesAbs = path.join(options.docs, options.root, IMAGES_DIR)
  const copied = []
  const pruned = []
  const rebuiltNames = new Map()
  for (const item of [...state.managed, ...state.retired]) {
    if (!item.name) continue
    if (!rebuiltNames.has(item.entry)) rebuiltNames.set(item.entry, new Set())
    rebuiltNames.get(item.entry).add(item.name)
  }
  const rebuiltAreas = new Set([...state.ready, ...state.retired.map((item) => item.entry)])
  const namesPresent = presentNames ?? collectPresentNames(entries, options)
  const imagesFailed = isUnderFailed(IMAGES_DIR, state.failedDirs)

  if (expected.size && !imagesFailed) {
    if (lstat(imagesAbs)?.isSymbolicLink()) fs.rmSync(imagesAbs)
    fs.mkdirSync(imagesAbs, { recursive: true })
    for (const [flatName, source] of expected) {
      const dest = path.join(imagesAbs, flatName)
      const current = lstat(dest)
      if (current?.isFile() && fs.readFileSync(dest).equals(fs.readFileSync(source))) continue
      if (current?.isSymbolicLink()) fs.rmSync(dest)
      fs.copyFileSync(source, dest)
      copied.push(flatName)
    }
  }

  if (lstat(imagesAbs)?.isDirectory() && !imagesFailed) {
    for (const name of fs.readdirSync(imagesAbs).sort()) {
      const abs = path.join(imagesAbs, name)
      if (collisions.has(name) || ambiguous?.has(name)) continue
      if (!lstat(abs)?.isFile() || expected.has(name)) continue
      const owners = imageOwners(entries, namesPresent, name)
      const rebuilt = ({ entry, name: ownerName }) =>
        ownerName ? (rebuiltNames.get(entry) ?? new Set()).has(ownerName) : rebuiltAreas.has(entry)
      if (!owners.length || !owners.every(rebuilt)) continue
      fs.rmSync(abs)
      pruned.push(name)
    }
  }

  return { expected: new Set(expected.keys()), copied, pruned }
}

function unmanagedFiles(entries, state, options) {
  const unmanaged = new Set()
  const ownedDirs = new Set()

  for (const folder of state.versions) ownedDirs.add(folder.dir)
  for (const mirror of state.mirrors) ownedDirs.add(mirror.dir)

  const derivedFiles = new Set(state.derivedFiles)
  for (const item of state.managed) {
    for (const name of item.files) derivedFiles.add(`${item.latestDir}/${name}`)
  }
  const mirrorRoots = new Set(
    entries.filter((entry) => entry.mode === 'mirror').map((entry) => entry.path),
  )
  const topFiles = new Map(
    entries.map((entry) => [entry.path, new Set(entry.topFiles ?? [])]),
  )
  const rootAbs = path.join(options.docs, options.root)

  const walk = (relDir) => {
    for (const name of fs.readdirSync(path.join(rootAbs, relDir)).sort()) {
      const rel = relDir ? `${relDir}/${name}` : name
      const abs = path.join(rootAbs, rel)
      const stats = lstat(abs)
      if (!stats) continue
      if (stats.isDirectory()) {
        if (ownedDirs.has(rel)) continue
        if (isUnderFailed(rel, state.failedDirs)) continue
        if (isInsideMirror(entries, rel)) continue
        walk(rel)
        continue
      }
      if (!stats.isFile()) {
        if (!state.failedDirs.has(relDir)) unmanaged.add(rel)
        continue
      }
      if (state.failedDirs.has(relDir)) continue
      if (derivedFiles.has(rel)) continue
      if (relDir === IMAGES_DIR && state.expectedImages.has(name)) continue
      const parent = parentOf(rel)
      if (mirrorRoots.has(parent)) continue
      if ((topFiles.get(parent) ?? new Set()).has(name)) continue
      unmanaged.add(rel)
    }
  }
  walk('')

  for (const entry of entries) {
    if (entry.mode !== 'mirror' || state.ready.has(entry)) continue
    if (isDirectory(entry.path, options)) unmanaged.add(entry.path)
  }

  return [...unmanaged].sort()
}

function isUnderFailed(relPath, failedDirs) {
  for (const dir of failedDirs) {
    if (dir === '' || relPath === dir || relPath.startsWith(`${dir}/`)) return true
  }
  return false
}

function isInsideMirror(entries, relPath) {
  return entries.some((entry) => entry.mode === 'mirror' && relPath.startsWith(`${entry.path}/`))
}

function renderSummary(state, entries, options) {
  const lines = []
  lines.push('# docs_hub rebuild')
  lines.push('')
  lines.push(`Root folder: \`${options.root}\``)
  lines.push(
    `Registry: ${entries.length} Areas (${entries.filter((entry) => entry.mode === 'release').length} release, ${entries.filter((entry) => entry.mode === 'mirror').length} mirror)`,
  )

  lines.push('')
  lines.push('## Areas')
  for (const entry of entries) {
    const details =
      entry.mode === 'release'
        ? [entry.unnamed ? 'unnamed' : 'named', `versionsUrl ${entry.versionsUrl}`].join(', ')
        : 'mirror'
    lines.push(`- \`${entry.path}\` — ${entry.mode} (${details}), source \`${entry.source}\``)
  }

  lines.push('')
  lines.push(`## Ownership failures (${state.failures.length})`)
  for (const failure of state.failures) {
    lines.push(`- \`${failure.path}\` — ${failure.reason}`)
  }

  lines.push('')
  lines.push(`## Managed names (${state.managed.length})`)
  for (const item of state.managed) {
    lines.push(`- \`${options.root}/${item.dir}\` ${item.version}`)
  }

  lines.push('')
  lines.push('## Images')
  lines.push(`- expected: ${state.expectedImages.size}`)
  lines.push(`- copied: ${state.copiedImages.length}`)
  lines.push(`- pruned: ${state.pruned.length}`)
  for (const name of state.pruned) lines.push(`  - pruned \`${name}\``)

  lines.push('')
  lines.push(`## Unmanaged files (${state.unmanaged.length})`)
  for (const rel of state.unmanaged) lines.push(`- \`${rel}\``)

  lines.push('')
  return lines.join('\n')
}

function refuseSymlinkedRoot(options) {
  let relPath = ''
  for (const segment of options.root.split('/')) {
    relPath = relPath ? `${relPath}/${segment}` : segment
    const stats = lstat(path.join(options.docs, relPath))
    if (!stats) return
    if (stats.isSymbolicLink()) {
      throw new FatalError(
        `--root must not cross a symlink inside the docs checkout: "${relPath}" is a symlink`,
      )
    }
  }
}

function main(argv) {
  const options = parseArgs(argv)
  refuseSymlinkedRoot(options)
  const registryPath = path.isAbsolute(options.registry)
    ? options.registry
    : path.resolve(process.cwd(), options.registry)
  if (!fs.existsSync(registryPath)) {
    throw new FatalError(`cannot read the Registry at "${registryPath}"`)
  }
  const entries = parseRegistry(fs.readFileSync(registryPath, 'utf8'))

  if (entries.length === 0) {
    writeSummary('# docs_hub rebuild\n\nRegistry is empty: add entries to `.docs-hub/registry.yaml`.\n')
    return 0
  }

  const rootStats = lstat(path.join(options.docs, options.root))
  if (!rootStats) {
    writeSummary(
      `# docs_hub rebuild\n\nRoot folder \`${options.root}\` does not exist yet: nothing to rebuild.\n`,
    )
    return 0
  }
  if (!rootStats.isDirectory()) {
    throw new FatalError(`--root "${options.root}" exists but is not a folder`)
  }

  const found = discover(entries, options)

  const plans = []
  for (const entry of entries) {
    if (entry.mode !== 'release') continue
    const groups = new Map()
    for (const folder of found.versions.filter((item) => item.entry === entry)) {
      const key = entry.unnamed ? '' : folder.metadata.name
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(folder)
    }
    for (const group of groups.values()) {
      const failedDirs = [...found.failedDirs].filter((dir) => ownerOf(entries, dir) === entry)
      const plan = releasePlan(entry, group, options, failedDirs)
      const owner = ownerOf(entries, plan.target)
      if (owner && owner !== entry) {
        found.failures.push({
          path: plan.target,
          reason: `Latest destination "${plan.target}" is owned by the Area "${owner.path}"`,
        })
        continue
      }
      if (isUnderFailed(plan.target, found.failedDirs)) continue
      plans.push(plan)
    }
  }

  const failedNames = failedNamesByFolder(entries, found.failedDirs)
  const retired = []
  for (const [nameDir, { entry, dirs }] of failedNames) {
    if (found.versions.some((item) => item.entry === entry && parentOf(item.dir) === nameDir)) continue
    const target = entry.unnamed ? `${entry.path}/${entry.latest}` : nameDir
    if (isUnderFailed(target, found.failedDirs) || ownerOf(entries, target) !== entry) continue
    retireName({ versionsFile: `${nameDir}/versions.json`, target, dirs }, options)
    retired.push({ entry, name: entry.unnamed ? '' : path.posix.basename(nameDir) })
  }
  const areasWithFolders = new Set([
    ...found.versions.map((item) => item.entry),
    ...[...failedNames.values()].map((failed) => failed.entry),
  ])
  for (const entry of [...areasWithFolders]) {
    if (isUnderFailed(entry.path, found.failedDirs)) areasWithFolders.delete(entry)
  }

  const state = {
    failures: found.failures,
    failedDirs: found.failedDirs,
    versions: found.versions,
    mirrors: found.mirrors,
    managed: [],
    retired,
    derivedFiles: [],
    ready: new Set(),
    expectedImages: new Set(),
    copiedImages: [],
    pruned: [],
    unmanaged: [],
  }

  const presentNames = collectPresentNames(entries, options)
  const willRebuildNames = new Map()
  for (const plan of plans) {
    if (!plan.name) continue
    if (!willRebuildNames.has(plan.entry)) willRebuildNames.set(plan.entry, new Set())
    willRebuildNames.get(plan.entry).add(plan.name)
  }
  for (const item of retired) {
    if (!item.name) continue
    if (!willRebuildNames.has(item.entry)) willRebuildNames.set(item.entry, new Set())
    willRebuildNames.get(item.entry).add(item.name)
  }
  const willRebuildAreas = new Set([
    ...plans.map((plan) => plan.entry),
    ...found.mirrors.map((mirror) => mirror.entry),
    ...retired.map((item) => item.entry),
  ])
  const images = expectedImages(
    entries,
    [
      ...plans.map((plan) => ({ dir: plan.versionDir, entry: plan.entry, name: plan.name })),
      ...found.mirrors.map((mirror) => ({ dir: mirror.dir, entry: mirror.entry, name: '' })),
    ],
    options,
    presentNames,
    { names: willRebuildNames, areas: willRebuildAreas },
    found.failedDirs,
  )
  for (const [flatName, sources] of images.collisions) {
    found.failures.push({
      path: `${IMAGES_DIR}/${flatName}`,
      reason:
        `flat image name "${flatName}" is claimed by more than one source: ` +
        [...sources].sort().map((source) => `"${source}"`).join(', '),
    })
  }
  for (const [flatName, info] of images.ambiguous) {
    found.failures.push({
      path: `${IMAGES_DIR}/${flatName}`,
      reason:
        `flat image name "${flatName}" is ambiguous: "${info.rel}" could belong to ` +
        info.owners.map((owner) => `"${owner}"`).join(', '),
    })
  }

  if (isUnderFailed(IMAGES_DIR, found.failedDirs)) images.expected.clear()

  const applied = applyReleases(plans, entries, options, images.expected, areasWithFolders)
  found.failures.push(...applied.blocked)
  state.managed = applied.managed
  state.derivedFiles = applied.derivedFiles
  for (const item of state.managed) state.ready.add(item.entry)
  for (const mirror of state.mirrors) state.ready.add(mirror.entry)

  const appliedImages = applyImages(entries, state, options, images, presentNames)
  state.expectedImages = appliedImages.expected
  state.copiedImages = appliedImages.copied
  state.pruned = appliedImages.pruned

  state.unmanaged = unmanagedFiles(entries, state, options)

  writeSummary(renderSummary(state, entries, options))

  return found.failures.length ? 1 : 0
}

function writeSummary(summary) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
  process.stdout.write(summary)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (error) {
    if (error instanceof FatalError) {
      process.stderr.write(`docs_hub: ${error.message}\n`)
      process.exit(2)
    }
    process.stderr.write(`docs_hub: unexpected error: ${error.stack ?? error}\n`)
    process.exit(2)
  }
}
