# 输出契约（Agent 必读）

> 这是 `take validate` 校验的精确契约。Agent 生成 shots.json 时必须逐字段对齐。

## 文件布局

```
project/
├── script.md           # 剧本原文
├── take.config.json    # 项目配置（模型路由等）
├── shots.json          # 结构化分镜（Agent 产出 + 校验对象）
├── storyboard.md       # 人类可读分镜表（take export 生成）
└── assets/
    ├── images/         # 生成的分镜图
    └── videos/         # 生成的视频
```

## shots.json 结构

```jsonc
{
  "title": "my-film",
  "aspectRatio": "16:9",            // "16:9" | "9:16" | "1:1" | "4:3" | "21:9"
  "style": "neo-noir, teal-orange", // 全局风格（可选）
  "source": "agent",                // "agent" | "manual" | "imported"
  "shots": [
    {
      "id": "shot-001",             // 必须 ^shot-\d+$
      "beatId": "beat-001",         // 必须 ^beat-\d+$，且存在对应 beat
      "index": 1,                   // 必须从 1 连续递增
      "summary": "侦探走进雨巷",
      "durationSec": 4,             // > 0
      "shotSize": "wide",           // 受控词表
      "angle": "eye-level",         // 受控词表
      "movement": "static",         // 受控词表
      "characters": ["detective"],  // 字符串数组
      "location": "city-street",    // 可选
      "lighting": "neon-glow",      // 可选
      "tone": "noir",               // 可选
      "imagePrompt": "夜晚的雨巷，一名穿驼色风衣的侦探独自走来...",
      "videoPrompt": "镜头缓慢推进，雨滴落在镜头前...",  // 可选
      "visual": {                   // 可选：一致性参考
        "characterRefs": { "detective": "assets/ref-detective.png" },
        "styleRef": "assets/style-ref.png"
      },
      "status": "approved",         // "draft" | "approved" | "rendering" | "done" | "failed"
      "notes": "导演备注：节奏要慢"   // 可选
    }
  ]
}
```

## 必填字段（缺一即校验失败）

- shot：`id` `beatId` `index` `summary` `durationSec` `shotSize` `angle` `movement` `characters` `imagePrompt` `status`
- 顶层：`title` `aspectRatio` `source` `shots`（≥1）

## 完整性规则（validate 的跨字段检查）

1. `id` 全局唯一，不得重复。
2. `index` 必须从 1 开始严格连续（1,2,3…）。
3. `beatId` 不得悬空（shots.json 中允许 beat 未单独列出，但同 id 应可追溯）。
4. `status` 为 `rendering`/`done`/`failed` 的 shot 不可再被 generate 处理（先改回 `approved`/`draft`）。

## storyboard.md 契约（export 产物，可 import 回写）

```markdown
# my-film

> Aspect ratio: **16:9** ｜ Source: **agent**

### Shot 1

- **id**: shot-001
- **beatId**: beat-001
- **summary**: 侦探走进雨巷
- **durationSec**: 4
- **shotSize**: wide
- **angle**: eye-level
- **movement**: static
- **characters**: detective
- **status**: approved

**Image prompt**: 夜晚的雨巷...
```

格式要求：
- 每个 shot 用 `### Shot N` 起头（N 与 index 一致）。
- 字段用 `- **key**: value` 列表。
- 提示词用 `**Image prompt**: ...` / `**Video prompt**: ...` 独立段落。

## 常见错误自查

- ❌ `index: 0` 或跳号 → 必须从 1 连续
- ❌ 景别写 `macro` / `extreme close` → 必须用词表值（连字符、无空格）
- ❌ 运镜写 `pan`（无方向）→ 用 `pan-left` / `pan-right`
- ❌ 忘写 `imagePrompt` → 必填
- ❌ status 写成 `pending` → 词表内没有，用 `draft`
