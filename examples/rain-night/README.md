# rain-night — worked example

A complete take project demonstrating the full pipeline on a 3-scene suspense
short: 《雨夜》(Rain Night).

## What this shows

| File | Role |
| --- | --- |
| `script.md` | The input screenplay (3 scenes, 5 beats). |
| `shots.json` | The agent's storyboard output, strictly per the [output contract](../../skills/take/references/output-contract.md): 5 beats, 10 shots, controlled shot-language vocabulary, per-shot `imagePrompt` (+`videoPrompt` where motion matters). |
| `storyboard.md` | The human-readable export (`take export storyboard`) — machine-parseable round-trip. |
| `take.config.json` | v2 config: ordered failover chain for video (Seedance → Minimax), secrets as `apiKeyEnv` references. |

## Reproduce it

```bash
cp -R examples/rain-night my-run && cd my-run
take validate                 # shots.json passes the contract
take generate images --mock   # offline smoke
take generate video --mock
take export storyboard        # regenerates storyboard.md
```

With real keys configured (`TAKE_IMAGE_API_KEY`, `TAKE_VIDEO_API_KEY`) drop
`--mock` and the same commands produce real stills and clips.

## Reading the shot design

- Shot rhythm alternates scale (wide → extreme-close → close → wide) to avoid
  three same-scale shots in a row; action beats run short (3s), emotional
  beats long (4–5s).
- Every `imagePrompt` follows the skill's five-part structure: subject+action,
  scene, camera language, lighting, style anchor (`neo-noir, teal-and-orange,
  35mm film grain` from the global `style`).
- `videoPrompt`s add motion and explicit duration — only where motion matters;
  static shots omit them.
