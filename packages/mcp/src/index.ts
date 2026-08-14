/**
 * take MCP server (stdio). Exposes the take workflow as tools so that any
 * MCP-capable agent (Claude Code, Codex, zcode, ...) can drive storyboard
 * creation and rendering without shelling out to the CLI.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { handleToolCall } from './tools/handler.js';

const TOOL_DEFINITIONS = [
  {
    name: 'validate_shots',
    description: 'Validate shots.json (or storyboard.md) against the take contract.',
    inputSchema: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'optional file path relative to cwd' },
        config: { type: 'boolean', description: 'validate take.config.json instead' },
      },
    },
  },
  {
    name: 'generate_images',
    description: 'Render approved shots to storyboard stills via the image provider (GPT-image-2).',
    inputSchema: {
      type: 'object',
      properties: {
        mock: { type: 'boolean', description: 'use mock provider (no API keys)' },
      },
    },
  },
  {
    name: 'generate_video',
    description: 'Render approved shots to video via the video provider (Seedance 2.x, fallback Minimax H3).',
    inputSchema: {
      type: 'object',
      properties: {
        mock: { type: 'boolean', description: 'use mock provider (no API keys)' },
      },
    },
  },
  {
    name: 'export_storyboard',
    description: 'Export shots.json to storyboard.md (human-readable + machine-parseable).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'doctor',
    description: 'Check provider configuration and connectivity.',
    inputSchema: { type: 'object', properties: {} },
  },
] as const;

export function createServer(options: { cwd?: string } = {}): Server {
  const cwd = options.cwd ?? process.cwd();
  const server = new Server({ name: 'take-mcp', version: '0.1.0' }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, (args ?? {}) as Record<string, unknown>, cwd);
  });

  return server;
}

export async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Entry point when run directly.
const isMain = process.argv[1]?.endsWith('index.js') || process.argv[1]?.includes('take-mcp');
if (isMain) {
  void main().catch((error) => {
    console.error(`take-mcp failed to start: ${String(error)}`);
    process.exit(1);
  });
}
