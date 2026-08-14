# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Report privately
to the maintainer via GitHub's private vulnerability reporting (Security tab →
"Report a vulnerability"), or by email to the address listed on the profile.

We will acknowledge reports within 72 hours and work toward a fix and
disclosure.

## Scope

- `packages/*` source code
- Provider clients (no secrets are ever logged)
- The MCP server surface

## Out of scope

- Misconfiguration of third-party model provider accounts
- Secrets committed by users in their own projects

## Key handling

- API keys are read from environment variables or `take.config.json` (git-ignored).
- The MCP/CLI never echoes full keys; `take doctor` prints only the presence and
  the last 4 characters.
