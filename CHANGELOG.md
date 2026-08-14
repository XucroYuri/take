# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial project scaffold.
- `@take-ai/core`: domain models (script, beat, shot, storyboard), Zod schemas,
  JSON/Markdown serialization.
- `@take-ai/provider`: provider abstraction, GPT-image-2 / Seedance 2.0 / 2.5 /
  Minimax H3 clients, failover router, mock provider.
- `@take-ai/cli`: `take` CLI (init, validate, generate, export, doctor).
- `@take-ai/mcp`: MCP server (stdio) exposing take tools.
- `skills/take`: agent skill with workflow, shot-language reference and output contract.
