#!/usr/bin/env node
import { findProjectRoot } from '@take-ai/core';
import type { GenerateResult } from '@take-ai/provider';
import { Command } from 'commander';
import { doctor } from './commands/doctor.js';
import { exportStoryboard, importStoryboard } from './commands/export.js';
import { generateImages, generateVideos } from './commands/generate.js';
import { initProject } from './commands/init.js';
import { validateConfig, validateFile } from './commands/validate.js';

const program = new Command();

program
  .name('take')
  .description('Take your script to the screen. Agent-first storyboard & AI film production toolkit.')
  .version('0.1.0');

/**
 * Resolve the enclosing take project root, or exit with a diagnosis.
 * Walking up lets every command run from any subdirectory of a project.
 */
function requireProject(): string {
  const root = findProjectRoot(process.cwd());
  if (root !== undefined) return root;
  console.error(`✗ no take project found (looked for take.config.json / shots.json upward from ${process.cwd()})`);
  console.error('  run `take init <name>` to create one, or cd into an existing project directory.');
  process.exit(1);
}

program
  .command('init')
  .description('scaffold a new take project')
  .argument('<name>', 'project name')
  .action(async (name: string) => {
    const { root } = await initProject(name, process.cwd());
    console.log(`✓ created project at ${root}`);
    console.log('  next: open it in your agent and ask it to 分镜 your script.');
  });

program
  .command('validate')
  .description('validate shots.json (or storyboard.md) against the take contract')
  .argument('[file]', 'file to validate (default: shots.json)')
  .option('-c, --config', 'validate take.config.json instead')
  .action(async (file: string | undefined, opts: { config?: boolean }) => {
    const projectRoot = requireProject();
    const outcome = opts.config ? await validateConfig(projectRoot) : await validateFile(file, projectRoot);
    for (const issue of outcome.issues) console.log(`✗ ${issue.path}: ${issue.message}`);
    for (const warning of outcome.warnings) console.log(`! ${warning}`);
    if (outcome.ok && outcome.warnings.length === 0) console.log(`✓ ${outcome.path} is valid`);
    process.exit(outcome.ok && outcome.warnings.length === 0 ? 0 : 1);
  });

program
  .command('generate')
  .description('render approved shots through the provider router')
  .argument('<stage>', 'images | video')
  .option('--mock', 'use the mock provider (no API keys required)')
  .option('--resume', 'skip shots whose input hash matches a completed job')
  .option('-c, --concurrency <n>', 'parallel jobs (default 2)', '2')
  .action(async (stage: string, opts: { mock?: boolean; resume?: boolean; concurrency?: string }) => {
    const projectRoot = requireProject();
    const generateOptions: {
      mock: boolean;
      resume: boolean;
      concurrency: number;
      root: string;
    } = { mock: false, resume: false, concurrency: Number(opts.concurrency), root: projectRoot };
    if (opts.mock === true) generateOptions.mock = true;
    if (opts.resume === true) generateOptions.resume = true;
    const results: GenerateResult[] =
      stage === 'video'
        ? await generateVideos(process.cwd(), generateOptions)
        : await generateImages(process.cwd(), generateOptions);
    const done = results.filter((r) => r.status === 'done');
    const skipped = results.filter((r) => r.status === 'skipped');
    const failed = results.filter((r) => r.status !== 'done' && r.status !== 'skipped');
    console.log(`✓ ${stage}: ${done.length} done, ${skipped.length} skipped (resume), ${failed.length} failed`);
    for (const r of done) console.log(`  ✓ ${r.shotId} → ${r.assetPath ?? ''}`);
    for (const r of skipped) console.log(`  ○ ${r.shotId} skipped (unchanged input)`);
    for (const r of failed) console.log(`  ✗ ${r.shotId} ${r.status}${r.error ? ` — ${r.error}` : ''}`);
    if (failed.length > 0) process.exit(1);
  });

program
  .command('jobs')
  .description('list background jobs from the .take/jobs.json event log')
  .action(async () => {
    const projectRoot = requireProject();
    const { JobEventLog } = await import('@take-ai/provider');
    const log = new JobEventLog({ root: projectRoot });
    await log.load();
    const events = log.all();
    if (events.length === 0) {
      console.log('no jobs recorded');
      return;
    }
    for (const event of events) {
      const suffix =
        event.type === 'done'
          ? ' ✓'
          : event.type === 'failed' || event.type === 'cancelled'
            ? ` ✗ ${event.error ?? ''}`
            : '';
      console.log(`${event.at}  ${event.kind} ${event.jobId}  ${event.type}${suffix}`);
    }
  });

program
  .command('export')
  .description('export shots.json → storyboard.md, or import the reverse')
  .argument('<direction>', 'storyboard (export) | import')
  .action(async (direction: string) => {
    const projectRoot = requireProject();
    if (direction === 'storyboard') {
      const target = await exportStoryboard(projectRoot);
      console.log(`✓ storyboard written to ${target}`);
    } else if (direction === 'import') {
      const target = await importStoryboard(projectRoot);
      console.log(`✓ shots.json written to ${target}`);
    } else {
      console.error(`unknown export direction: ${direction} (use storyboard | import)`);
      process.exit(1);
    }
  });

program
  .command('doctor')
  .description('check environment and provider connectivity')
  .action(async () => {
    const report = await doctor();
    console.log(`node ${report.node}`);
    console.log(
      `image:  ${report.imageProvider.configured ? 'configured' : 'MISSING KEY'} (${report.imageProvider.model})`,
    );
    console.log(
      `video:  ${report.videoProvider.configured ? 'configured' : 'MISSING KEY'} (${report.videoProvider.model})`,
    );
    console.log(
      `fallback video: ${report.fallbackVideoProvider.configured ? 'configured' : 'MISSING KEY'} (${report.fallbackVideoProvider.model})`,
    );
    for (const h of report.health) {
      console.log(`${h.ok ? '✓' : '✗'} ${h.provider} (${h.latencyMs}ms)${h.error ? ` — ${h.error}` : ''}`);
    }
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(String(error));
  process.exit(1);
});
