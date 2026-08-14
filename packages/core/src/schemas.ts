import { z } from 'zod';

export const scriptSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  source: z.string().optional(),
});

export const beatSchema = z.object({
  id: z.string().regex(/^beat-\d+$/),
  index: z.number().int().positive(),
  summary: z.string().min(1),
  purpose: z.string().min(1),
  emotion: z.string().optional(),
  sceneId: z.string().optional(),
});

export const visualReferenceSchema = z.object({
  characterRefs: z.record(z.string()).optional(),
  styleRef: z.string().optional(),
});

export const shotSchema = z.object({
  id: z.string().regex(/^shot-\d+$/),
  beatId: z.string().regex(/^beat-\d+$/),
  index: z.number().int().positive(),
  summary: z.string().min(1),
  durationSec: z.number().positive(),
  shotSize: z.enum(['extreme-wide', 'wide', 'full', 'medium', 'medium-close', 'close', 'extreme-close']),
  angle: z.enum(['eye-level', 'low', 'high', 'dutch', 'over-shoulder', 'aerial', 'bird', 'worm']),
  movement: z.enum([
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
  ]),
  characters: z.array(z.string()),
  location: z.string().optional(),
  lighting: z.string().optional(),
  tone: z.string().optional(),
  imagePrompt: z.string().min(1),
  videoPrompt: z.string().optional(),
  visual: visualReferenceSchema.optional(),
  status: z.enum(['draft', 'approved', 'rendering', 'done', 'failed']),
  assets: z
    .object({
      image: z.string().optional(),
      video: z.string().optional(),
    })
    .optional(),
  notes: z.string().optional(),
});

export const storyboardSchema = z.object({
  title: z.string().min(1),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3', '21:9']),
  style: z.string().optional(),
  source: z.enum(['agent', 'manual', 'imported']),
  shots: z.array(shotSchema),
  beats: z.array(beatSchema).optional(),
});

export const projectConfigSchema = z.object({
  name: z.string().min(1),
  aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3', '21:9']),
  style: z.string().optional(),
  image: z.object({
    provider: z.literal('gpt-image'),
    model: z.string().optional(),
    fallback: z
      .object({
        provider: z.string(),
        model: z.string().optional(),
      })
      .optional(),
  }),
  video: z.object({
    provider: z.enum(['seedance', 'minimax']),
    model: z.string().optional(),
    fallback: z
      .object({
        provider: z.enum(['seedance', 'minimax']),
        model: z.string().optional(),
      })
      .optional(),
  }),
  render: z
    .object({
      imageSize: z.string().optional(),
      videoDurationSec: z.number().positive().optional(),
      videoResolution: z.enum(['720p', '1080p']).optional(),
      concurrency: z.number().int().positive().optional(),
    })
    .optional(),
});

export type ScriptInput = z.input<typeof scriptSchema>;
export type BeatInput = z.input<typeof beatSchema>;
export type ShotInput = z.input<typeof shotSchema>;
export type StoryboardInput = z.input<typeof storyboardSchema>;
export type ProjectConfigInput = z.input<typeof projectConfigSchema>;
