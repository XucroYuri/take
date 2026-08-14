# @take-ai/provider

The dsh-aligned provider layer: seam triangle, stable error codes, production
transport, universal OpenAI-compatible adapter, jobs, capabilities, config v2,
orchestration.

## Layout

```
src/
  seam.ts          ProviderSeam (Service Definition role)
  errors.ts        TakeError taxonomy (dsh-aligned codes)
  capabilities.ts  CapabilityRegistry (model metadata + pre-validation)
  config.ts        config v2 (cordis.yml-minded) + v1 auto-migration
  jobs.ts          JobRegistry (dsh ctx.jobs semantics)
  jobs-local.ts    .take/jobs.json event log
  orchestration.ts shared batch generation (CLI + MCP consumers)
  router.ts        capability-aware failover router
  transport/       retry, rate-limit, http (timeout tiers, attribution)
  adapters/        openai-compatible (universal) + thin configs + mock
```

## Extension points

- **New vendor** → add a config entry (`adapter: openai-compatible` covers
  most) or a thin adapter class under `adapters/`.
- **New capability** → design the full seam triangle (Definition in
  `seam.ts` / Provider in `adapters/` / Consumer in `cli`+`mcp`).

## Known Limitations and Deferred Work

- **Polling-only job delivery.** Async jobs poll at a fixed interval; webhook
  delivery is a reserved strategy seam, not implemented.
- **No weighted routing.** Config `weight` is parsed but routing is strict
  order (primary → fallbacks); weighted dispatch activates when a second
  equal-priority provider ships.
- **OpenAI-compatible image fallback is unset.** `image` chains have no
  shipped fallback adapter; a Gemini-compatible entry can be added via config
  but is not pre-wired.
