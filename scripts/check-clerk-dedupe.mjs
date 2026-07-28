#!/usr/bin/env node
/**
 * Fails if the mobile app would bundle more than one copy of a Clerk package.
 *
 * Why this exists
 * ---------------
 * Clerk's React context object lives in @clerk/shared/react. <ClerkProvider>
 * is rendered from @clerk/expo, while hooks reached through @clerk/react read
 * the context as *that* package resolved it. If the two end up on different
 * copies of @clerk/shared, they get different context objects: the provider
 * writes into one, the hook reads the other, finds nothing, and throws
 *
 *   "useSignIn can only be used within the <ClerkProvider /> component"
 *
 * on every render of the sign-in AND sign-up screens.
 *
 * That happened for real: @clerk/expo declares "@clerk/shared": "^4.23.0" and
 * resolved to 4.23.0, while @clerk/react resolved to 4.25.8. Both auth screens
 * became completely unreachable, and it shipped in two App Store builds
 * unnoticed — because an already-signed-in session never renders them. It only
 * surfaced when a user got logged out.
 *
 * Nothing about that failure is visible at install time and TypeScript can't
 * see it either, so this check is the guard. It compares resolved versions
 * rather than declared ranges, because the ranges were always compatible — it
 * was the resolution that diverged.
 */

import { existsSync, realpathSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mobileModules = join(repoRoot, 'artifacts', 'mobile', 'node_modules');

/** Packages whose duplication breaks React context identity. */
const WATCHED = ['@clerk/shared', '@clerk/react', '@clerk/expo', '@clerk/clerk-js'];

/** Entry points the mobile app actually pulls Clerk in through. */
const ROOTS = ['@clerk/expo', '@clerk/react'];

function versionOf(pkgDir) {
  try {
    return JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).version;
  } catch {
    return null;
  }
}

/**
 * Resolve `dep` as seen from inside `fromPkgDir`, following pnpm's symlinks.
 *
 * pnpm does NOT nest a package's dependencies inside it. Given a real path of
 *   .../.pnpm/<hash>/node_modules/@clerk/expo
 * its dependencies sit as *siblings* under that same node_modules:
 *   .../.pnpm/<hash>/node_modules/@clerk/shared
 * so the sibling lookup is the one that matters here. The nested path is still
 * checked first to stay correct under npm/yarn-style hoisting.
 */
function resolveFrom(fromPkgDir, dep) {
  const nested = join(fromPkgDir, 'node_modules', dep);
  if (existsSync(nested)) return realpathSync(nested);

  // Walk up out of the package's own name segments to its containing
  // node_modules ("@clerk/expo" = 2 segments, "expo" = 1).
  const upLevels = dep.startsWith('@') ? 2 : 2; // fromPkgDir is always scoped here
  const containingModules = resolve(fromPkgDir, ...Array(upLevels).fill('..'));
  const sibling = join(containingModules, dep);
  if (existsSync(sibling)) return realpathSync(sibling);

  return null;
}

const findings = new Map(); // pkg name -> Map<version, Set<who resolved it>>

function record(pkg, version, via) {
  if (!version) return;
  if (!findings.has(pkg)) findings.set(pkg, new Map());
  const byVersion = findings.get(pkg);
  if (!byVersion.has(version)) byVersion.set(version, new Set());
  byVersion.get(version).add(via);
}

if (!existsSync(mobileModules)) {
  console.log('[clerk-dedupe] artifacts/mobile/node_modules not present — skipping (run after install).');
  process.exit(0);
}

for (const rootName of ROOTS) {
  const rootLink = join(mobileModules, rootName);
  if (!existsSync(rootLink)) continue;

  const rootDir = realpathSync(rootLink);
  record(rootName, versionOf(rootDir), `artifacts/mobile -> ${rootName}`);

  // Each root's own view of every watched package is what decides context identity.
  for (const dep of WATCHED) {
    if (dep === rootName) continue;
    const depDir = resolveFrom(rootDir, dep);
    if (depDir) record(dep, versionOf(depDir), `${rootName} -> ${dep}`);
  }
}

const duplicated = [...findings.entries()].filter(([, byVersion]) => byVersion.size > 1);

if (duplicated.length === 0) {
  const summary = [...findings.entries()]
    .map(([pkg, byVersion]) => `${pkg}@${[...byVersion.keys()][0]}`)
    .join(', ');
  console.log(`[clerk-dedupe] OK — single instance of each: ${summary || '(no Clerk packages found)'}`);
  process.exit(0);
}

console.error('\n[clerk-dedupe] FAILED — a Clerk package resolves to more than one version.\n');
for (const [pkg, byVersion] of duplicated) {
  console.error(`  ${pkg} is duplicated:`);
  for (const [version, viaSet] of byVersion) {
    console.error(`    ${version}  (via ${[...viaSet].join(', ')})`);
  }
}
console.error(`
This breaks sign-in and sign-up at runtime — <ClerkProvider> and the auth
hooks would get different React context objects, and both screens throw on
every render. TypeScript and the build will NOT catch it.

Fix: force one version by adding a scoped override in pnpm-workspace.yaml,
e.g.

  overrides:
    "@clerk/expo>@clerk/shared": "<the newer version>"

then re-run pnpm install. Pick a version that satisfies every declared range
(check each package's "dependencies" field), and re-run this script.
`);
process.exit(1);
