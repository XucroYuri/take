# take workflow

End-to-end flow from script to rendered video.

## 1. Scaffold

```bash
take init my-film
```

Creates `script.md`, `take.config.json`, `shots.json`, `assets/`.

## 2. Write or paste the script

Edit `script.md`. For pasted text, write it into `script.md` first — the
project is the file tree.

## 3. Let the agent break it down (agent's own model)

Ask the agent (with the take skill loaded): *"分镜这个故事"*.

The agent:
1. identifies beats (`beat-001`...) with summary/purpose/emotion
2. designs shots per beat using the controlled shot-language vocabulary
3. writes `shots.json` per the output contract
4. runs `take validate` (or MCP `validate_shots`) and fixes any issue

## 4. Validate

```bash
take validate            # shots.json
take validate -c         # take.config.json
take validate storyboard.md
```

## 5. Generate images

```bash
take generate images --mock   # offline, deterministic
take generate images          # GPT-image-2, one still per approved shot
```

Outputs land in `assets/images/<shot-id>.png` (pointer files in mock mode).

## 6. Generate video

```bash
take generate video --mock
take generate video           # Seedance 2.x → Minimax H3 on failure
```

Outputs land in `assets/videos/<shot-id>.mp4` (pointer files in mock mode).

## 7. Export & review

```bash
take export storyboard        # shots.json → storyboard.md
take export import            # storyboard.md → shots.json (round-trip)
```

Edit `storyboard.md` by hand if needed, then re-import.

## 8. Iterate

Change `status` back to `approved`/`draft`, tweak prompts, re-run generate.
Retake is a normal part of the workflow — the files make it cheap.
