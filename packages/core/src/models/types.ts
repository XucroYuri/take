import type { AnalysisSource, AspectRatio, CameraAngle, CameraMovement, ShotSize, ShotStatus } from './enums.js';

/**
 * A screenplay document. The raw text lives in `content`; structural
 * interpretation (beats, shots) is the agent's job, not core's.
 */
export interface Script {
  /** Project-unique title. */
  title: string;
  /** Raw script text (plain text or Markdown). */
  content: string;
  /** Optional provenance. */
  source?: string;
}

/**
 * A beat (节拍) — the smallest narrative unit worth showing.
 * Beats are the bridge between story and shots.
 */
export interface Beat {
  /** Stable id, e.g. `beat-001`. */
  id: string;
  /** 1-based order within the script. */
  index: number;
  /** One-line summary of what happens. */
  summary: string;
  /** Why this beat exists (narrative function). */
  purpose: string;
  /** Emotional tone, e.g. `tension`, `relief`. */
  emotion?: string;
  /** Optional grouping, e.g. scene reference `scene-02`. */
  sceneId?: string;
}

/** Visual consistency hooks, used to keep character/scene drift low. */
export interface VisualReference {
  /** Character reference: name → reference image URL or token. */
  characterRefs?: Record<string, string>;
  /** Global style reference URL or style token. */
  styleRef?: string;
}

/**
 * A shot (镜头) — the atomic unit of the storyboard and of rendering.
 * `imagePrompt` / `videoPrompt` are produced by the agent (or hand-written)
 * following the output contract; core validates and renders them.
 */
export interface Shot {
  /** Stable id, e.g. `shot-001`. */
  id: string;
  /** Parent beat id. */
  beatId: string;
  /** 1-based order within the storyboard. */
  index: number;
  /** What we see in this shot. */
  summary: string;
  /** Target duration in seconds. */
  durationSec: number;
  shotSize: ShotSize;
  angle: CameraAngle;
  movement: CameraMovement;
  /** Characters present, as defined in project assets. */
  characters: string[];
  /** Location / set reference. */
  location?: string;
  /** Lighting direction, e.g. `golden-hour backlight`. */
  lighting?: string;
  /** Mood / tone of the shot. */
  tone?: string;
  /** Full image-generation prompt (GPT-image-2 friendly). */
  imagePrompt: string;
  /** Optional video-generation prompt (Seedance/Minimax friendly). */
  videoPrompt?: string;
  /** Visual consistency references for this shot. */
  visual?: VisualReference;
  status: ShotStatus;
  /** Rendered assets: url / local path per stage. */
  assets?: {
    image?: string;
    video?: string;
  };
  /** Free-form notes (director notes, retakes). */
  notes?: string;
}

/** The storyboard: an ordered list of shots plus production metadata. */
export interface Storyboard {
  /** Storyboard title, usually the project name. */
  title: string;
  aspectRatio: AspectRatio;
  /** Global style descriptor applied to every shot unless overridden. */
  style?: string;
  /** How the shots were produced. */
  source: AnalysisSource;
  shots: Shot[];
  /** Optional beat list for cross-reference validation. */
  beats?: Beat[];
}

/** Project-level config consumed by the render pipeline (take.config.json). */
export interface ProjectConfig {
  name: string;
  aspectRatio: AspectRatio;
  style?: string;
  /** Image provider routing. */
  image: {
    provider: 'gpt-image';
    model?: string;
    fallback?: {
      provider: string;
      model?: string;
    };
  };
  /** Video provider routing. */
  video: {
    provider: 'seedance' | 'minimax';
    model?: string;
    fallback?: {
      provider: 'seedance' | 'minimax';
      model?: string;
    };
  };
  /** Rendering defaults. */
  render?: {
    imageSize?: string;
    videoDurationSec?: number;
    videoResolution?: '720p' | '1080p';
    concurrency?: number;
  };
}
