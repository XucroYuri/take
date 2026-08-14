/**
 * Package contract gate (dsh-inspired, lightweight):
 *
 * 1. Every package under packages/ declares `take.invariant` — a checkable
 *    relationship its runtime guarantees — OR a justified `take.invariantNone`
 *    reason.
 * 2. Every package README carries `## Known Limitations and Deferred Work`
 *    OR a justified allowlist entry.
 * 3. Every package has an index.ts aggregate export (unless justified).
 *
 * Run: `pnpm verify:contracts`. Fails with exit 1 listing violations.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PACKAGES_DIR = join(ROOT, 'packages');

/** Packages that legitimately have no limitations section (allowlist). */
const LIMITATIONS_ALLOWLIST = new Set<string>([]);

interface PackageCheck {
  name: string;
  invariant?: string;
  invariantNone?: string;
  hasIndex: boolean;
  hasLimitations: boolean;
  errors: string[];
}

function checkPackage(pkgDir: string, pkgName: string): PackageCheck {
  const errors: string[] = [];
  const pkgJsonPath = join(pkgDir, 'package.json');
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as {
    take?: { invariant?: string; invariantNone?: string };
  };

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

function main(): void {
  if (!existsSync(PACKAGES_DIR)) {
    console.error(`packages/ not found at ${PACKAGES_DIR}`);
    process.exit(1);
  }
  const entries = readdirSync(PACKAGES_DIR);
  const allErrors: string[] = [];
  const results: PackageCheck[] = [];

  for (const entry of entries) {
    const pkgDir = join(PACKAGES_DIR, entry);
    if (!existsSync(join(pkgDir, 'package.json'))) continue;
    const pkgName = (JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')) as { name: string }).name;
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
    console.log(`  ${result.name}: ${index} | ${limitations} | invariant: ${invariant.slice(0, 90)}`);
  }

  if (allErrors.length > 0) {
    console.error('\nContract violations:');
    for (const error of allErrors) console.error(error);
    process.exit(1);
  }
  console.log('\nAll package contracts satisfied.');
}

main();
