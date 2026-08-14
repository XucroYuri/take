import { describe, expect, it } from 'vitest';
import {
  buildShotGrid,
  parseStoryboardMarkdown,
  storyboardToMarkdown,
  validateProjectConfig,
  validateStoryboard,
  validateStoryboardFull,
} from '../src/index.js';
import type { Storyboard } from '../src/index.js';

function sampleStoryboard(overrides: Partial<Storyboard> = {}): Storyboard {
  return {
    title: 'Sample',
    aspectRatio: '16:9',
    source: 'agent',
    shots: [
      {
        id: 'shot-001',
        beatId: 'beat-001',
        index: 1,
        summary: 'A detective enters the rainy street.',
        durationSec: 4,
        shotSize: 'wide',
        angle: 'eye-level',
        movement: 'static',
        characters: ['detective'],
        location: 'city-street',
        lighting: 'neon-glow',
        tone: 'noir',
        imagePrompt: 'Neon-lit rainy street at night, lone detective walking, film noir style',
        status: 'approved',
      },
    ],
    ...overrides,
  };
}

describe('validateStoryboard', () => {
  it('accepts a valid storyboard', () => {
    const sb = sampleStoryboard();
    expect(validateStoryboard(sb)).toEqual([]);
  });

  it('rejects a missing required field', () => {
    const sb = sampleStoryboard();
    const { imagePrompt, ...rest } = sb.shots[0]!;
    void imagePrompt;
    const invalid = { ...sb, shots: [rest] };
    expect(validateStoryboard(invalid).length).toBeGreaterThan(0);
  });

  it('rejects bad enum value', () => {
    const sb = sampleStoryboard();
    const bad = {
      ...sb,
      shots: [{ ...sb.shots[0]!, shotSize: 'macro' }],
    };
    expect(validateStoryboard(bad).length).toBeGreaterThan(0);
  });

  it('rejects non-integer index', () => {
    const sb = sampleStoryboard();
    const bad = { ...sb, shots: [{ ...sb.shots[0]!, index: 1.5 }] };
    expect(validateStoryboard(bad).length).toBeGreaterThan(0);
  });
});

describe('validateStoryboardFull', () => {
  it('catches duplicate shot ids', () => {
    const sb = sampleStoryboard();
    const dup = {
      ...sb,
      shots: [sb.shots[0]!, { ...sb.shots[0]!, index: 2, id: 'shot-001', beatId: 'beat-002' }],
    };
    const { issues } = validateStoryboardFull(dup);
    expect(issues.some((i) => i.message.includes('duplicate'))).toBe(true);
  });

  it('catches out-of-order indices', () => {
    const sb = sampleStoryboard();
    const bad = {
      ...sb,
      shots: [
        { ...sb.shots[0]!, index: 2, id: 'shot-002' },
        { ...sb.shots[0]!, index: 1, id: 'shot-001' },
      ],
    };
    const { issues } = validateStoryboardFull(bad);
    expect(issues.some((i) => i.message.includes('expected index'))).toBe(true);
  });

  it('catches dangling beat references', () => {
    const sb = sampleStoryboard({ beats: [{ id: 'beat-001', index: 1, summary: 'x', purpose: 'y' }] });
    const bad = { ...sb, shots: [{ ...sb.shots[0]!, beatId: 'beat-999' }] };
    const { issues } = validateStoryboardFull(bad);
    expect(issues.some((i) => i.message.includes('dangling'))).toBe(true);
  });
});

describe('validateProjectConfig', () => {
  it('accepts a valid config', () => {
    const config = {
      name: 'my-film',
      aspectRatio: '16:9',
      image: { provider: 'gpt-image', model: 'gpt-image-2' },
      video: { provider: 'seedance', model: 'seedance-2.5' },
    };
    expect(validateProjectConfig(config)).toEqual([]);
  });

  it('rejects unsupported video provider', () => {
    const config = {
      name: 'my-film',
      aspectRatio: '16:9',
      image: { provider: 'gpt-image' },
      video: { provider: 'sora2' },
    };
    expect(validateProjectConfig(config).length).toBeGreaterThan(0);
  });
});

describe('buildShotGrid', () => {
  it('builds a 3x3 grid with 9 cells and labels', () => {
    const sb = sampleStoryboard();
    const grid = buildShotGrid(sb.shots[0]!);
    expect(grid.cells).toHaveLength(3);
    expect(grid.cells[0]).toHaveLength(3);
    expect(grid.labels[0]).toEqual(['BG-L', 'BG-C', 'BG-R']);
    expect(grid.cells[0]?.[0]).toContain(sb.shots[0]!.imagePrompt);
  });
});

describe('markdown round-trip', () => {
  it('serializes and parses back with equal shots', () => {
    const sb = sampleStoryboard();
    const md = storyboardToMarkdown(sb);
    const { storyboard } = parseStoryboardMarkdown(md);
    expect(storyboard.title).toBe(sb.title);
    expect(storyboard.aspectRatio).toBe(sb.aspectRatio);
    expect(storyboard.shots).toHaveLength(1);
    expect(storyboard.shots[0]!.id).toBe('shot-001');
    expect(storyboard.shots[0]!.imagePrompt).toBe(sb.shots[0]!.imagePrompt);
    expect(storyboard.shots[0]!.shotSize).toBe('wide');
    expect(storyboard.shots[0]!.characters).toEqual(['detective']);
  });

  it('keeps multi-shot ordering', () => {
    const sb = sampleStoryboard({
      shots: [
        {
          id: 'shot-001',
          beatId: 'beat-001',
          index: 1,
          summary: 'First shot.',
          durationSec: 3,
          shotSize: 'close',
          angle: 'eye-level',
          movement: 'static',
          characters: [],
          imagePrompt: 'close-up of a key turning',
          status: 'draft',
        },
        {
          id: 'shot-002',
          beatId: 'beat-001',
          index: 2,
          summary: 'Second shot.',
          durationSec: 5,
          shotSize: 'full',
          angle: 'low',
          movement: 'dolly-in',
          characters: ['hero'],
          imagePrompt: 'hero standing under a spotlight',
          status: 'approved',
        },
      ],
    });
    const md = storyboardToMarkdown(sb);
    const { storyboard } = parseStoryboardMarkdown(md);
    expect(storyboard.shots.map((s) => s.id)).toEqual(['shot-001', 'shot-002']);
    expect(storyboard.shots[1]!.movement).toBe('dolly-in');
  });
});
