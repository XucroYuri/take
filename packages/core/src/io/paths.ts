/**
 * take project layout. Everything is a file; this module knows the canonical
 * paths so that CLI, MCP and the agent skill agree on where things live.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface ProjectPaths {
  root: string;
  script: string;
  config: string;
  shots: string;
  storyboard: string;
  assetsImages: string;
  assetsVideos: string;
}

/** Canonical file layout for a take project directory. */
export function projectPaths(root: string): ProjectPaths {
  return {
    root,
    script: `${root}/script.md`,
    config: `${root}/take.config.json`,
    shots: `${root}/shots.json`,
    storyboard: `${root}/storyboard.md`,
    assetsImages: `${root}/assets/images`,
    assetsVideos: `${root}/assets/videos`,
  };
}

/** All artifact files (excludes assets and config). */
export const ARTIFACT_FILES = ['script.md', 'shots.json', 'storyboard.md', 'take.config.json'] as const;

/** Marker files that identify a take project root. */
const PROJECT_MARKERS = ['take.config.json', 'shots.json'] as const;

/**
 * Walk up from `startDir` looking for a take project root (a directory
 * containing a project marker file). Returns undefined when none is found.
 * Lets every take command run from any subdirectory of the project.
 */
export function findProjectRoot(startDir: string): string | undefined {
  let current = startDir;
  while (true) {
    for (const marker of PROJECT_MARKERS) {
      if (existsSync(join(current, marker))) return current;
    }
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}
