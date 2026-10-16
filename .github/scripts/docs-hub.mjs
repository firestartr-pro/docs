#!/usr/bin/env node
// docs_hub rebuild script.
//
// This file is rendered verbatim into the docs repository (it contains no
// Mustache), so the tests exercise the same file that runs in the workflow.
//
// It reads the Registry (.docs-hub/registry.yaml, edited by hand in the docs
// repo and converted to JSON by the workflow with `yq -o=json`), validates every folder's metadata against it, then rebuilds the
// Derived files: `versions.json`, `index.json`, the Latest copies and the flat
// `images/` folder. It never touches a file it does not own.
//
// Every path handled here is relative to the root folder (`site/raw`) unless it
// is built with `abs()`.
//
// Exit codes: 0 = rebuilt, 1 = rebuilt with ownership failures, 2 = fatal.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const NUMERIC_IDENTIFIER = '0|[1-9]\\d*'
const PRERELEASE_IDENTIFIER = '(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)'
const BUILD_IDENTIFIER = '[0-9A-Za-z-]+'
// SemVer 2.0.0 with the approved leading "v": no leading zeros in the numeric
// identifiers, and build metadata accepted but kept out of the ordering (it is
// validated, never captured).
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
// A managed name is one folder name, and not a file or folder the hub writes or reads.
const RESERVED_NAMES = new Set(['index.json', 'versions.json', 'meta.json', '.meta.json', IMAGES_DIR])

export class FatalError extends Error {}

/**
 * A URL path: each segment percent-encoded, joined by "/". An empty segment is
 * left out, so an unnamed Area's URL has no extra "/". The sub-delimiters that
 * are legal in a path stay as written, so a semver build "+" is not escaped.
 */
function urlPath(segments) {
  return segments
    .filter((segment) => segment !== '')
    .flatMap((segment) => segment.split('/'))
    .map((segment) =>
      encodeURIComponent(segment).replace(/%(2B|2C|3A|3B|3D|40|24|26)/gi, (escape) =>
        decodeURIComponent(escape),
      ),
    )
    .join('/')
}

/** The Area path with "/" turned into "-", used by the image naming rule. */
export function areaSlug(areaPath) {
  return areaPath.split('/').join('-')
}

/**
 * The image naming rule shared with `docs_publisher`: an image's flat name is
 * the Area slug, then the managed name for a release Area, then the image's
 * path relative to the `images/` directory it lives in, with "/" turned into
 * "-". `name` is empty for Mirror Areas and unnamed release Areas.
 */
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
  // BigInt: a numeric identifier past 2^53 must not compare equal to its neighbour.
  return {
    major: BigInt(match[1]),
    minor: BigInt(match[2]),
    patch: BigInt(match[3]),
    pre: match[4] ?? null,
  }
}

/** Ascending semver order, with a leading "v" and prereleases handled. */
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
  // A `--root` with an empty, absolute, `.`/`..`, doubled or trailing-slash
  // segment would let the hub write outside its folder, so it is refused.
  const segments = options.root.split('/')
  if (options.root === '' || segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new FatalError(`--root must be a normalized folder inside the docs checkout, got "${options.root}"`)
  }
  // `--docs` is the checkout the workflow hands us, so it is resolved with
  // `stat`; everything below it is read with `lstat` and a symlink is skipped.
  if (!fs.existsSync(options.docs) || !fs.statSync(options.docs).isDirectory()) {
    throw new FatalError(`docs checkout "${options.docs}" is not a directory`)
  }
  return options
}

/** Parses and validates the Registry, naming the offending entry on any error. */
export function parseRegistry(text) {
  // The workflow converts registry.yaml to JSON with `yq -o=json` and passes
  // the result to --registry, so this reads one JSON document: an array of
  // entries. An empty file converts to `null`, which means no entries.
  // An empty Registry is a safe no-op: a fresh install ships the starter
  // registry.yaml with `[]`, so there is simply nothing to rebuild yet.
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
    // The flat `images/` folder is written by the hub alone: no Area may sit in it.
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
      // `versions.json` links resolve it below each Version folder: a `..` or absolute path points outside it.
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
        // A folder named like a Version or like a derived file would collide
        // with the Version folders or the files the hub writes at the Area root.
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

    // `topFiles` is a YAML list of file names at the Area root.
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
      // The Area-root files the hub reads or writes: a declared file with one of
      // these names would have two writers, or be read as metadata.
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

/** The Registry entry with the longest matching path; a path has one owner. */
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

/**
 * `lstat`, never `stat`: the hub must never follow a checked-in symlink, which
 * could point outside the docs checkout. `null` when the path does not exist.
 */
function lstat(abs) {
  try {
    return fs.lstatSync(abs)
  } catch (error) {
    // Only a missing path is "absent"; any other failure (a file where a folder
    // should be, a permission error) is a broken checkout and stays fatal.
    if (error.code === 'ENOENT') return null
    throw error
  }
}

/** The regular files under `dir`, sorted; a symlink is skipped, never followed. */
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

/**
 * Finds and validates every metadata file under the root folder. A folder whose
 * metadata does not match the Registry is left untouched and reported as an
 * ownership failure.
 */
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
      // Neither a Version folder nor about a registered Area: not our metadata.
      continue
    }
    const owner = validateVersion(rel, folder, metadata, entries, fail)
    if (owner) versions.push({ rel, dir: folder, metadata, entry: owner })
  }

  // A folder that failed validation is untouched: a version or mirror folder
  // that is, or lies beneath, one (a stray metadata file in the same folder)
  // is not a rebuild source, so nothing is published from a failed folder.
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

/** One folder name: no "/", not "." or "..", and not a reserved name. */
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

/**
 * The Latest copy and `versions.json` of one managed name (or of an unnamed
 * Area). `versionDir` and `target` are relative to the root folder.
 */
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
    // The folders of this name that failed validation: only their top-level
    // files are read, to find the leftovers of a previous Latest copy. A folder
    // whose name is not a version never held a Latest copy.
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

// Code that a link inside is not rewritten: a fenced block, or an inline code
// span that opens and closes with a backtick run of the same length on one
// line (CommonMark). Indented code blocks are not recognised. The second group
// is the link destination: Markdown `](`, a reference definition `]: `, or an
// HTML `src=`/`href=` attribute.
const CODE_OR_LINK =
  /(```[\s\S]*?```|~~~[\s\S]*?~~~|(`+)(?!`)[^\n]*?(?<!`)\2(?!`))|(\]\(|\]:\s+|\b(?:src|href)=["'])(?:\.\/)?images\/([^\s)"'#?]+)/g

/**
 * Rewrites `images/<path>` link destinations to `./images/<flat name>` in a
 * Latest copy, outside code. Only a link whose image this run copies is
 * rewritten; a link the hub cannot resolve to exactly one flat image is left as
 * the publisher wrote it.
 */
export function rewriteImageLinks(content, imagesDir, expected, entry, name) {
  return content.replace(CODE_OR_LINK, (match, code, run, prefix, relPath) => {
    if (code !== undefined) return match
    if (relPath.split('/').some((segment) => segment === '' || segment === '..')) return match
    const flatName = flatImageName(entry.path, name, relPath)
    if (expected.get(flatName) !== path.join(imagesDir, relPath)) return match
    return `${prefix}./images/${flatName}`
  })
}

/** The top-level file names the given Version folders hold, meta.json aside. */
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

/**
 * The failed Version folders of each release name, keyed by the folder that
 * holds them: the Area itself for an unnamed Area, else the name folder. Only
 * the layout counts, since a failed folder's metadata is not trusted.
 */
function failedNamesByFolder(entries, failedDirs) {
  const names = new Map()
  for (const dir of failedDirs) {
    // A failed folder is only a Version folder when its name is a version: a
    // stray metadata file at another depth must not retire a name.
    if (!VERSION_PATTERN.test(path.posix.basename(dir))) continue
    const entry = ownerOf(entries, dir)
    if (!entry || entry.mode !== 'release') continue
    const nameDir = parentOf(dir)
    const inArea = entry.unnamed ? nameDir === entry.path : parentOf(nameDir) === entry.path
    if (!inArea) continue
    // A folder whose name is not a safe one is never a name: it is left alone.
    if (!entry.unnamed && !isSafeName(path.posix.basename(nameDir))) continue
    if (!names.has(nameDir)) names.set(nameDir, { entry, dirs: [] })
    names.get(nameDir).dirs.push(dir)
  }
  return names
}

/**
 * Removes what a name with no valid Version folder still publishes: its
 * versions.json and the leftovers of its Latest copy, which a failed folder of
 * the name holds. The failed folders are read, never written.
 */
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

/** Copies the top-level files of the newest Version folder into the Latest copy. */
function applyLatest(plan, options, expected) {
  const sourceAbs = path.join(options.docs, options.root, plan.versionDir)
  const imagesAbs = path.join(sourceAbs, IMAGES_DIR)
  const targetAbs = path.join(options.docs, options.root, plan.target)
  // The Latest copy folder belongs to the hub: a symlink planted in its place is
  // replaced by a real folder, never written through.
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

  // A top-level file is only a leftover of a previous Latest copy when a Version
  // folder of the same name holds a file with that name, valid or failed (a
  // failed folder is read, never written); anything else (a hand-written file)
  // stays in place and is listed as Unmanaged.
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

/**
 * Writes a hub-owned file, replacing a symlink planted at its path: the hub
 * never writes through a symlink, which could point outside the checkout.
 */
function writeOwned(absPath, content) {
  if (lstat(absPath)?.isSymbolicLink()) fs.rmSync(absPath)
  fs.writeFileSync(absPath, content)
}

function writeJson(absPath, value) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true })
  writeOwned(absPath, `${JSON.stringify(value, null, 2)}\n`)
}

/**
 * Writes `versions.json`, the Latest copies and `index.json`. `areasWithFolders`
 * holds the release Areas that have a Version folder, valid or failed.
 */
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
    // An Area with no Version folder yet is still being migrated: leave its
    // existing index.json alone rather than publish an empty list. An Area with
    // a folder that failed is indexed as empty, so its retired names drop out.
    if (named.length === 0 && !areasWithFolders.has(entry)) continue

    const indexFile = `${entry.path}/index.json`
    const indexAbs = path.join(options.docs, options.root, indexFile)
    // A folder of that name (a name folder that failed validation) stands where
    // the index file goes: it cannot be written, so the Area keeps no index.
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

/**
 * Every owner a flat image could have: each Registry Area whose slug prefixes
 * the file name, as itself for a Mirror or unnamed release Area, and as each of
 * its present names that matches for a named release Area. Empty when none can
 * own it.
 */
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

/**
 * Every name present in a named release Area, so an image is attributed to
 * the longest matching name even when that name is legacy or failed. A folder
 * owned by a more-specific Registry entry (a nested Area) is not a name of
 * this Area.
 */
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

/** The owner folder of a flat image candidate: the name folder, or the Area itself. */
function ownerDir(owner) {
  return owner.name ? `${owner.entry.path}/${owner.name}` : owner.entry.path
}

/**
 * The flat images the Registry expects (newest Version folders, then Mirrors)
 * and the flat names more than one source claims. `sources` are the
 * `{dir, entry, name}` triples to collect, newest Version folder first. A
 * claimed name is copied from no source: the hub reports the collision instead
 * of letting one source win it silently.
 *
 * A singly-claimed name with another possible owner that is not rebuilding
 * this run (an unmanaged name sharing the prefix included) is ambiguous: it is
 * reported instead of being copied, before any Latest link is rewritten.
 * `willRebuild` holds the names and Areas that rebuild this run (plans,
 * mirrors and retirements), using the same ownership data as pruning.
 */
function expectedImages(entries, sources, options, presentNames, willRebuild, failedDirs) {
  const claimed = new Map()

  for (const { dir, entry, name } of sources) {
    const imagesAbs = path.join(options.docs, options.root, dir, IMAGES_DIR)
    if (!lstat(imagesAbs)?.isDirectory()) continue
    for (const rel of relativeFiles(imagesAbs)) {
      const sourceRel = path.posix.join(dir, IMAGES_DIR, rel)
      // A nested Area's images belong to that Area's own Registry entry.
      const owner = ownerOf(entries, sourceRel)
      if (owner && owner !== entry) continue
      // Nothing under a failed folder is published as a flat image.
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

/** Copies the expected images into the flat images folder and prunes stale ones. */
function applyImages(entries, state, options, images, presentNames) {
  const { expected, collisions, ambiguous } = images
  const imagesAbs = path.join(options.docs, options.root, IMAGES_DIR)
  const copied = []
  const pruned = []
  // The names this run rebuilt, managed or retired: a retired name's images are
  // pruned like a managed name's. An Area with neither has no name to prune for.
  const rebuiltNames = new Map()
  for (const item of [...state.managed, ...state.retired]) {
    if (!item.name) continue
    if (!rebuiltNames.has(item.entry)) rebuiltNames.set(item.entry, new Set())
    rebuiltNames.get(item.entry).add(item.name)
  }
  const rebuiltAreas = new Set([...state.ready, ...state.retired.map((item) => item.entry)])
  const namesPresent = presentNames ?? collectPresentNames(entries, options)
  // A failed flat images folder is left alone: nothing is copied into it and
  // nothing is pruned from it.
  const imagesFailed = isUnderFailed(IMAGES_DIR, state.failedDirs)

  if (expected.size && !imagesFailed) {
    // The hub owns the flat images folder: a symlink planted in its place is
    // replaced by a real folder, never written through.
    if (lstat(imagesAbs)?.isSymbolicLink()) fs.rmSync(imagesAbs)
    fs.mkdirSync(imagesAbs, { recursive: true })
    for (const [flatName, source] of expected) {
      const dest = path.join(imagesAbs, flatName)
      const current = lstat(dest)
      if (current?.isFile() && fs.readFileSync(dest).equals(fs.readFileSync(source))) continue
      // A symlink planted at a flat name is replaced, never written through.
      if (current?.isSymbolicLink()) fs.rmSync(dest)
      fs.copyFileSync(source, dest)
      copied.push(flatName)
    }
  }

  if (lstat(imagesAbs)?.isDirectory() && !imagesFailed) {
    for (const name of fs.readdirSync(imagesAbs).sort()) {
      const abs = path.join(imagesAbs, name)
      // A colliding or ambiguous flat name stays exactly as the hub found it.
      if (collisions.has(name) || ambiguous?.has(name)) continue
      if (!lstat(abs)?.isFile() || expected.has(name)) continue
      // Pruned only when every owner the name could have rebuilt this run: one
      // that did not may still publish the image. Otherwise it is Unmanaged.
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

/**
 * Lists the files under the root folder that are neither managed by the hub nor
 * a declared top-of-Area file, so nothing is deleted by surprise.
 */
function unmanagedFiles(entries, state, options) {
  const unmanaged = new Set()
  const ownedDirs = new Set()

  for (const folder of state.versions) ownedDirs.add(folder.dir)
  for (const mirror of state.mirrors) ownedDirs.add(mirror.dir)

  // A managed name's folder is walked too, so a hand-written file the Latest
  // copy did not write stays visible as Unmanaged.
  const derivedFiles = new Set(state.derivedFiles)
  for (const item of state.managed) {
    for (const name of item.files) derivedFiles.add(`${item.latestDir}/${name}`)
  }
  // A Mirror Area's root files belong to its publisher; for a release Area only
  // the file names the entry declares are exempt from the Unmanaged list.
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
      // A symlink (or any other special file) is never followed; it stays in
      // place and is listed.
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

  // A registered Mirror Area that has not been published yet is not hub-managed
  // metadata, and the walk cannot see it inside a published parent Area.
  for (const entry of entries) {
    if (entry.mode !== 'mirror' || state.ready.has(entry)) continue
    if (isDirectory(entry.path, options)) unmanaged.add(entry.path)
  }

  return [...unmanaged].sort()
}

/** Whether a path is a failed folder or lies under one. */
function isUnderFailed(relPath, failedDirs) {
  for (const dir of failedDirs) {
    // A failed folder at the root (recorded as '') is an ancestor of every
    // root-relative path, so a root ownership failure protects the whole tree.
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

/**
 * Every existing component of `--root` is read with `lstat`: a symlinked one
 * would let the hub read and write outside the docs checkout, so it is refused
 * before anything is read or written. A component that does not exist ends the
 * walk; the root check below handles it.
 */
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

  // A fresh install ships the starter registry.yaml with `[]`: the run
  // succeeds, touches nothing, and tells the reader to add entries.
  if (entries.length === 0) {
    writeSummary('# docs_hub rebuild\n\nRegistry is empty: add entries to `.docs-hub/registry.yaml`.\n')
    return 0
  }

  // A fresh docs repo has no root folder until its first publisher writes one:
  // there is nothing to rebuild, which is not an error. A root that is there but
  // not a folder is a broken checkout, which is fatal.
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
      // A failed folder another Registry entry owns (a Mirror Area) is not this name's.
      const failedDirs = [...found.failedDirs].filter((dir) => ownerOf(entries, dir) === entry)
      const plan = releasePlan(entry, group, options, failedDirs)
      const owner = ownerOf(entries, plan.target)
      if (owner && owner !== entry) {
        // The Latest copy would land inside another Registry entry's Area.
        found.failures.push({
          path: plan.target,
          reason: `Latest destination "${plan.target}" is owned by the Area "${owner.path}"`,
        })
        continue
      }
      // A failed folder and everything under it is untouched and unindexed.
      if (isUnderFailed(plan.target, found.failedDirs)) continue
      plans.push(plan)
    }
  }

  // A name with no valid Version folder left is retired, so its published files
  // do not outlive the folder that made them. A name with a valid folder is not.
  // The retired names also lose their flat images, in applyImages.
  const failedNames = failedNamesByFolder(entries, found.failedDirs)
  const retired = []
  for (const [nameDir, { entry, dirs }] of failedNames) {
    if (found.versions.some((item) => item.entry === entry && parentOf(item.dir) === nameDir)) continue
    const target = entry.unnamed ? `${entry.path}/${entry.latest}` : nameDir
    // Never retire into another Registry entry's Area, nor out of a failed folder.
    if (isUnderFailed(target, found.failedDirs) || ownerOf(entries, target) !== entry) continue
    retireName({ versionsFile: `${nameDir}/versions.json`, target, dirs }, options)
    retired.push({ entry, name: entry.unnamed ? '' : path.posix.basename(nameDir) })
  }
  const areasWithFolders = new Set([
    ...found.versions.map((item) => item.entry),
    ...[...failedNames.values()].map((failed) => failed.entry),
  ])
  // An Area that is, or lies beneath, a failed folder keeps no index: writing
  // one would publish an empty list inside a folder the hub must not touch.
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

  // The flat images are computed before the Latest copies, so a link is only
  // rewritten to a flat name this run really derives.
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

  // A failed flat images folder keeps its files and no link points at it:
  // clearing the destinations before the Latest copies are written leaves
  // every image link as the publisher wrote it.
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

// The summary also goes to stdout, so the run log holds it (the step summary is not in the log).
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
    // Any other error is fatal too: exit 1 would make the workflow commit a
    // half-done rebuild.
    process.stderr.write(`docs_hub: unexpected error: ${error.stack ?? error}\n`)
    process.exit(2)
  }
}
