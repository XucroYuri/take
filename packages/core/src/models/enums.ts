/**
 * Domain enums for the take core model.
 * These are the vocabulary of film language. The agent produces shots
 * using this vocabulary; take validates and renders them.
 */

/** Standard shot sizes (景别), from widest to tightest. */
export const SHOT_SIZES = ['extreme-wide', 'wide', 'full', 'medium', 'medium-close', 'close', 'extreme-close'] as const;
export type ShotSize = (typeof SHOT_SIZES)[number];

/** Camera angles (机位角度). */
export const CAMERA_ANGLES = ['eye-level', 'low', 'high', 'dutch', 'over-shoulder', 'aerial', 'bird', 'worm'] as const;
export type CameraAngle = (typeof CAMERA_ANGLES)[number];

/** Camera movements (运镜). */
export const CAMERA_MOVEMENTS = [
  'static',
  'pan-left',
  'pan-right',
  'tilt-up',
  'tilt-down',
  'dolly-in',
  'dolly-out',
  'tracking',
  'handheld',
  'crane-up',
  'crane-down',
  'zoom-in',
  'zoom-out',
  'orbit',
] as const;
export type CameraMovement = (typeof CAMERA_MOVEMENTS)[number];

/** Lifecycle of a shot. */
export const SHOT_STATUSES = ['draft', 'approved', 'rendering', 'done', 'failed'] as const;
export type ShotStatus = (typeof SHOT_STATUSES)[number];

/** Aspect ratios supported by the render pipeline. */
export const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '21:9'] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

/** Who produced a beat/shot breakdown. */
export const ANALYSIS_SOURCES = ['agent', 'manual', 'imported'] as const;
export type AnalysisSource = (typeof ANALYSIS_SOURCES)[number];
