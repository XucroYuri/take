# Model routing

## Policy

| Capability | Primary | Fallback | Rationale |
| --- | --- | --- | --- |
| Text / analysis | **agent's own model** | — | free, zero-latency, no lock-in |
| Image | **gpt-image-2** | (planned) gemini-2.5-flash-image | strongest current stills model |
| Video | **seedance-2.0 / 2.5** | **minimax-h3** | mainstream quality/cost; Sora2 retired |

Explicitly **not** supported: Sora2 (retired), older Wan/Veo paths (not
competitive), any model that cannot be expressed via the provider interface.

## Environment variables

| Variable | Used by | Default |
| --- | --- | --- |
| `TAKE_IMAGE_API_KEY` | GptImageProvider | — |
| `TAKE_IMAGE_BASE_URL` | GptImageProvider | `https://api.openai.com/v1` |
| `TAKE_IMAGE_MODEL` | GptImageProvider | `gpt-image-2` |
| `TAKE_VIDEO_API_KEY` | SeedanceProvider | — |
| `TAKE_VIDEO_BASE_URL` | SeedanceProvider | Volcengine Ark v3 |
| `TAKE_VIDEO_MODEL` | SeedanceProvider | `seedance-2.0` |
| `TAKE_FALLBACK_VIDEO_API_KEY` | MinimaxProvider | — |
| `TAKE_FALLBACK_VIDEO_BASE_URL` | MinimaxProvider | `https://api.minimaxi.com/v1` |
| `TAKE_FALLBACK_VIDEO_MODEL` | MinimaxProvider | `minimax-h3` |

The same values can be set in `take.config.json` (`image.model`,
`video.model`, `video.fallback.model`, ...).

## Router semantics

- Primary throws (auth, rate limit, network, model error) → try fallbacks in order.
- Only the first successful result is returned; the router reports which
  provider served the request so callers can surface it.
- `take doctor` runs `health()` on every configured provider.

## Upgrading models

```bash
export TAKE_VIDEO_MODEL=seedance-2.5
```

or edit `take.config.json`:

```json
{ "video": { "provider": "seedance", "model": "seedance-2.5" } }
```

No code changes required — model IDs never appear in business logic.
