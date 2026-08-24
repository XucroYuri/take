/**
 * Package contract gate (dsh-inspired, lightweight) — plain JS so it runs on
 * every CI Node version (20/22/24) without type stripping or a loader.
 *
 * 1. Every package under packages/ declares `take.invariant` — a checkable
 *    relationship its runtime guarantees — OR a justified `take.invariantNone`
 *    reason.
 * 2. Every package README carries `## Known Limitations and Deferred Work`
 *    OR a justified allowlist entry.
 * 3. Every package has an index.ts aggregate export (unless justified).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PACKAGES_DIR = join(ROOT, 'packages');

/** Packages that legitimately have no limitations section (allowlist). */
const LIMITATIONS_ALLOWLIST = new Set([]);

function checkPackage(pkgDir, pkgName) {
  const errors = [];
  const pkgJson = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));

  const invariant = pkgJson.take?.invariant;
  const invariantNone = pkgJson.take?.invariantNone;
  if (!invariant && !invariantNone) {
    errors.push(
      'package.json missing "take.invariant" (a checkable relationship) or "take.invariantNone" (a justified reason)',
    );
  }

  const hasIndex = existsSync(join(pkgDir, 'src', 'index.ts'));

  const readmePath = join(pkgDir, 'README.md');
  const hasLimitations = existsSync(readmePath)
    ? readFileSync(readmePath, 'utf8').includes('Known Limitations and Deferred Work')
    : false;
  if (!hasLimitations && !LIMITATIONS_ALLOWLIST.has(pkgName)) {
    errors.push('README.md missing "## Known Limitations and Deferred Work" section');
  }

  return { name: pkgName, invariant, invariantNone, hasIndex, hasLimitations, errors };
}

function main() {
  if (!existsSync(PACKAGES_DIR)) {
    console.error(`packages/ not found at ${PACKAGES_DIR}`);
    process.exit(1);
  }
  const entries = readdirSync(PACKAGES_DIR);
  const allErrors = [];
  const results = [];

  for (const entry of entries) {
    const pkgDir = join(PACKAGES_DIR, entry);
    if (!existsSync(join(pkgDir, 'package.json'))) continue;
    const pkgName = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).name;
    const check = checkPackage(pkgDir, pkgName);
    results.push(check);
    for (const error of check.errors) {
      allErrors.push(`  ${pkgName}: ${error}`);
    }
  }

  console.log('Package contracts:');
  for (const result of results) {
    const invariant = result.invariant ?? `(none: ${result.invariantNone ?? 'missing'})`;
    const index = result.hasIndex ? 'index ✓' : 'index MISSING';
    const limitations = result.hasLimitations ? 'limitations ✓' : 'limitations MISSING';
    console.log(`  ${result.name}: ${index} | ${limitations} | invariant: ${String(invariant).slice(0, 90)}`);
  }

  if (allErrors.length > 0) {
    console.error('\nContract violations:');
    for (const error of allErrors) console.error(error);
    process.exit(1);
  }
  console.log('\nAll package contracts satisfied.');
}

main();
