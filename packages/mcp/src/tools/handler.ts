/**
 * Tool execution logic (pure, testable). The MCP server wires this to
 * protocol handlers; tests call it directly.
 */
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { doctor } from './doctor.js';
import { exportStoryboard } from './export.js';
import { generateImages, generateVideos } from './generate.js';
import { validateConfig, validateFile } from './validate.js';

export type ToolResult = CallToolResult;

export async function handleToolCall(name: string, args: Record<string, unknown>, cwd: string): Promise<ToolResult> {
  try {
    switch (name) {
      case 'validate_shots': {
        const outcome = args.config
          ? await validateConfig(cwd)
          : await validateFile(typeof args.file === 'string' ? args.file : undefined, cwd);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ ok: outcome.ok, issues: outcome.issues, warnings: outcome.warnings }, null, 2),
            },
          ],
        };
      }
      case 'generate_images': {
        const outputs = await generateImages(cwd, { mock: args.mock === true });
        return { content: [{ type: 'text', text: JSON.stringify({ outputs }, null, 2) }] };
      }
      case 'generate_video': {
        const outputs = await generateVideos(cwd, { mock: args.mock === true });
        return { content: [{ type: 'text', text: JSON.stringify({ outputs }, null, 2) }] };
      }
      case 'export_storyboard': {
        const target = await exportStoryboard(cwd);
        return { content: [{ type: 'text', text: JSON.stringify({ target }, null, 2) }] };
      }
      case 'doctor': {
        const report = await doctor();
        return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
      }
      default:
        return { content: [{ type: 'text', text: `unknown tool: ${name}` }], isError: true };
    }
  } catch (error) {
    return { content: [{ type: 'text', text: `error: ${String(error)}` }], isError: true };
  }
}
