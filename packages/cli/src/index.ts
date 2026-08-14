#!/usr/bin/env node
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
    const outcome = opts.config ? await validateConfig(process.cwd()) : await validateFile(file, process.cwd());
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
  .action(async (stage: string, opts: { mock?: boolean }) => {
    const outputs =
      stage === 'video' ? await generateVideos(process.cwd(), opts) : await generateImages(process.cwd(), opts);
    console.log(`✓ generated ${outputs.length} ${stage}`);
    for (const out of outputs) console.log(`  ${out}`);
  });

program
  .command('export')
  .description('export shots.json → storyboard.md, or import the reverse')
  .argument('<direction>', 'storyboard (export) | import')
  .action(async (direction: string) => {
    if (direction === 'storyboard') {
      const target = await exportStoryboard(process.cwd());
      console.log(`✓ storyboard written to ${target}`);
    } else if (direction === 'import') {
      const target = await importStoryboard(process.cwd());
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
