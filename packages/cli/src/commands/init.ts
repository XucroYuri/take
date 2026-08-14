import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectPaths } from '@take-ai/core';
import type { TakeConfigV2 } from '@take-ai/provider';

const DEFAULT_CONFIG: TakeConfigV2 = {
  version: 2,
  providers: {
    image: [
      {
        id: 'gpt-image',
        adapter: 'gpt-image',
        apiKeyEnv: 'TAKE_IMAGE_API_KEY',
        model: 'gpt-image-2',
      },
    ],
    video: [
      {
        id: 'seedance',
        adapter: 'seedance',
        apiKeyEnv: 'TAKE_VIDEO_API_KEY',
        model: 'seedance-2.5',
      },
      {
        id: 'minimax',
        adapter: 'minimax',
        apiKeyEnv: 'TAKE_FALLBACK_VIDEO_API_KEY',
        model: 'minimax-h3',
      },
    ],
  },
  runtime: {
    concurrency: 2,
  },
};

export async function initProject(
  name: string,
  cwd: string,
): Promise<{ root: string; paths: ReturnType<typeof projectPaths> }> {
  const root = join(cwd, name);
  const paths = projectPaths(root);
  await mkdir(paths.assetsImages, { recursive: true });
  await mkdir(paths.assetsVideos, { recursive: true });

  await writeFile(paths.script, `# ${name}\n\n<!-- 把剧本写在这里，然后让 Agent 把它做成 Take 分镜。 -->\n`, 'utf8');
  await writeFile(paths.config, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, 'utf8');
  await writeFile(
    paths.shots,
    `${JSON.stringify({ title: name, aspectRatio: '16:9', source: 'agent', shots: [] }, null, 2)}\n`,
    'utf8',
  );
  await writeFile(join(root, '.gitignore'), 'assets/\n.take/\n', 'utf8');

  return { root, paths };
}
