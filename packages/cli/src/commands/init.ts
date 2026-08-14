import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectPaths } from '@take-ai/core';
import type { ProjectConfig } from '@take-ai/core';

const DEFAULT_CONFIG: ProjectConfig = {
  name: 'my-film',
  aspectRatio: '16:9',
  style: '',
  image: {
    provider: 'gpt-image',
    model: 'gpt-image-2',
  },
  video: {
    provider: 'seedance',
    model: 'seedance-2.5',
    fallback: {
      provider: 'minimax',
      model: 'minimax-h3',
    },
  },
  render: {
    imageSize: '1536x1024',
    videoDurationSec: 5,
    videoResolution: '1080p',
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
  await writeFile(paths.config, `${JSON.stringify({ ...DEFAULT_CONFIG, name }, null, 2)}\n`, 'utf8');
  await writeFile(
    paths.shots,
    `${JSON.stringify({ title: name, aspectRatio: '16:9', source: 'agent', shots: [] }, null, 2)}\n`,
    'utf8',
  );
  await writeFile(join(root, '.gitignore'), 'assets/\n.take/\n', 'utf8');

  return { root, paths };
}
