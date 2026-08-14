/**
 * take project layout. Everything is a file; this module knows the canonical
 * paths so that CLI, MCP and the agent skill agree on where things live.
 */

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
