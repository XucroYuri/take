import type { Storyboard } from '../models/types.js';

/**
 * Markdown serialization of a storyboard.
 * The format is human-readable AND machine-parseable: `take parse` can
 * round-trip this file back into structured JSON.
 */

export interface MarkdownParseResult {
  storyboard: Storyboard;
  warnings: string[];
}

const SHOT_RE = /^###\s+Shot\s+(\d+)/;
const KEY_RE = /^-\s*\*\*(\w+)\*\*:\s*(.*)$/;

/** Serialize a storyboard to Markdown. */
export function storyboardToMarkdown(storyboard: Storyboard): string {
  const lines: string[] = [];
  lines.push(`# ${storyboard.title}`);
  lines.push('');
  lines.push(`> Aspect ratio: **${storyboard.aspectRatio}** ｜ Source: **${storyboard.source}**`);
  if (storyboard.style) lines.push(`> Global style: ${storyboard.style}`);
  lines.push('');

  for (const shot of storyboard.shots) {
    lines.push(`### Shot ${shot.index}`);
    lines.push('');
    lines.push(`- **id**: ${shot.id}`);
    lines.push(`- **beatId**: ${shot.beatId}`);
    lines.push(`- **summary**: ${shot.summary}`);
    lines.push(`- **durationSec**: ${shot.durationSec}`);
    lines.push(`- **shotSize**: ${shot.shotSize}`);
    lines.push(`- **angle**: ${shot.angle}`);
    lines.push(`- **movement**: ${shot.movement}`);
    lines.push(`- **characters**: ${shot.characters.join(', ')}`);
    if (shot.location) lines.push(`- **location**: ${shot.location}`);
    if (shot.lighting) lines.push(`- **lighting**: ${shot.lighting}`);
    if (shot.tone) lines.push(`- **tone**: ${shot.tone}`);
    lines.push(`- **status**: ${shot.status}`);
    lines.push('');
    lines.push(`**Image prompt**: ${shot.imagePrompt}`);
    if (shot.videoPrompt) {
      lines.push('');
      lines.push(`**Video prompt**: ${shot.videoPrompt}`);
    }
    lines.push('');
    if (shot.notes) {
      lines.push(`> Note: ${shot.notes}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}

/** Parse a storyboard Markdown document back into a Storyboard. */
export function parseStoryboardMarkdown(markdown: string): MarkdownParseResult {
  const warnings: string[] = [];
  const lines = markdown.split('\n');
  const titleLine = lines[0]?.replace(/^#\s*/, '').trim() ?? 'Untitled';
  const aspectMatch = lines[2]?.match(/Aspect ratio:\s*\*\*([^*]+)\*\*/);
  const styleMatch = lines[3]?.match(/Global style:\s*(.+)/);
  const aspectRatio = (aspectMatch?.[1] ?? '16:9') as Storyboard['aspectRatio'];

  const shots: Storyboard['shots'] = [];
  let current: Partial<Storyboard['shots'][number]> | null = null;
  let mode: 'none' | 'image' | 'video' = 'none';
  const promptBuf: string[] = [];

  const flushPrompt = () => {
    if (!current) return;
    const text = promptBuf.join(' ').trim();
    if (mode === 'image' && text) current.imagePrompt = text.replace(/^\*\*Image prompt\*\*:\s*/, '').trim();
    if (mode === 'video' && text) current.videoPrompt = text.replace(/^\*\*Video prompt\*\*:\s*/, '').trim();
    promptBuf.length = 0;
    mode = 'none';
  };

  const pushShot = () => {
    if (current && current.index != null && current.id) {
      shots.push(current as Storyboard['shots'][number]);
    }
  };

  for (const line of lines) {
    const shotMatch = line.match(SHOT_RE);
    if (shotMatch) {
      flushPrompt();
      pushShot();
      current = { index: Number(shotMatch[1]), status: 'draft' } as Partial<Storyboard['shots'][number]>;
      continue;
    }
    if (!current) continue;

    const keyMatch = line.match(KEY_RE);
    if (keyMatch && mode === 'none') {
      const key = keyMatch[1] ?? '';
      const value = keyMatch[2] ?? '';
      switch (key) {
        case 'id':
          current.id = value.trim();
          break;
        case 'beatId':
          current.beatId = value.trim();
          break;
        case 'summary':
          current.summary = value.trim();
          break;
        case 'durationSec':
          current.durationSec = Number(value);
          break;
        case 'shotSize':
          current.shotSize = value.trim() as Storyboard['shots'][number]['shotSize'];
          break;
        case 'angle':
          current.angle = value.trim() as Storyboard['shots'][number]['angle'];
          break;
        case 'movement':
          current.movement = value.trim() as Storyboard['shots'][number]['movement'];
          break;
        case 'characters':
          current.characters = value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          break;
        case 'location':
          current.location = value.trim();
          break;
        case 'lighting':
          current.lighting = value.trim();
          break;
        case 'tone':
          current.tone = value.trim();
          break;
        case 'status':
          current.status = value.trim() as Storyboard['shots'][number]['status'];
          break;
        default:
          break;
      }
      continue;
    }

    if (line.startsWith('**Image prompt**')) {
      flushPrompt();
      mode = 'image';
      promptBuf.push(line);
      continue;
    }
    if (line.startsWith('**Video prompt**')) {
      flushPrompt();
      mode = 'video';
      promptBuf.push(line);
      continue;
    }
    if (mode !== 'none' && line.trim()) {
      promptBuf.push(line.trim());
    }
  }
  flushPrompt();
  pushShot();

  const incomplete = shots.filter((s) => !s.imagePrompt || !s.summary || !s.shotSize);
  if (incomplete.length > 0) {
    warnings.push(
      `${incomplete.length} shot(s) missing required fields (summary / shotSize / imagePrompt); they were dropped.`,
    );
  }

  const result: Storyboard = {
    title: titleLine,
    aspectRatio,
    source: 'imported',
    shots: shots.filter((s) => s.imagePrompt && s.summary && s.shotSize),
  };
  if (styleMatch?.[1]) result.style = styleMatch[1];

  return {
    storyboard: result,
    warnings,
  };
}
