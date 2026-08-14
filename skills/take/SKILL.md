---
name: take
description: >
  Agent-first storyboard & AI film production toolkit. Turns a script into
  beat → shot → storyboard → rendered stills/video, using the agent's own
  model for text analysis (no extra LLM API needed) and take's provider
  router for image (GPT-image-2) and video (Seedance 2.x, fallback Minimax H3)
  generation. Use when the user asks to 分镜 (storyboard), make a shot list,
  turn a script into images/video, plan a film's shots, or render a scene.
  Triggers: 分镜, storyboard, shot list, 镜头, 剧本转视频, AI film production.
---

# take — 把剧本送上银幕

`take` 是 Agent 原生的分镜与 AI 影视生产工具包。核心原则：

> **Agent 负责思考（剧本分析、节拍、镜头语言），take 负责渲染（图像/视频）。**

文本与剧本分析**默认使用 Agent 工具自身的模型能力**——不需要为分析配置任何 LLM API。
图像生成走 **GPT-image-2**，视频生成走 **Seedance 2.0/2.5**（主）→ **Minimax H3**（备）。

## 什么时候用

- 用户说"把这个剧本做成 Take 分镜 / 分镜一下 / 做成分镜脚本"
- 用户提供剧本，要求产出镜头列表、九宫格分镜、或直接生成视频
- 用户已有 shots.json / storyboard.md，要求校验、生成、导出

## 工作流（默认路径）

```
1. 读取剧本        → script.md（或用户直接粘贴的文本）
2. 节拍分解        → 用 Agent 自身模型：识别 beat（最小叙事单元），每拍给出
                     summary（发生了什么）+ purpose（为什么存在）+ emotion
3. 镜头设计        → 对每个 beat 拆出 shot：景别/角度/运镜/时长/人物/光影/氛围
4. 写 shots.json   → 严格按《输出契约》（references/output-contract.md）生成，
                     每个 shot 必须含 imagePrompt（GPT-image-2 友好）与可选 videoPrompt
5. 校验            → 运行 `take validate`（或 MCP validate_shots），有错即修
6. 生成            → `take generate images` → `take generate video`
                     （或 MCP generate_images / generate_video）
7. 导出            → `take export storyboard` 生成 storyboard.md 供人类审阅
```

## 硬性规则

- **文本分析绝不调 LLM API**：分析、拆解、提示词编写全部由 Agent 自身完成。
- **模型路由由 take 决定**：不要向用户或代码里写死 Sora2 等已退市模型；视频主
  用 Seedance 2.0/2.5，备选 Minimax H3；图像主用 GPT-image-2。
- **一切皆文件**：项目 = `script.md` + `shots.json` + `storyboard.md` +
  `take.config.json`。不引入任何隐藏状态。
- **镜头语言有约束**：景别/角度/运镜必须使用 `references/shot-language.md`
  中的受控词表（core 的 zod schema 会校验，非法值直接报错）。
- **先校验后生成**：shots.json 未通过 `take validate` 之前不得进入生成步骤。

## 参考文档

| 文档 | 内容 |
|---|---|
| [references/workflow.md](references/workflow.md) | 完整工作流细节、各步骤要点 |
| [references/shot-language.md](references/shot-language.md) | 镜头语言受控词表（景别/角度/运镜/光影） |
| [references/model-routing.md](references/model-routing.md) | 模型路由与 failover 说明 |
| [references/output-contract.md](references/output-contract.md) | shots.json / storyboard.md 输出契约（必读） |
| [references/examples.md](references/examples.md) | 端到端示例（剧本→shots.json 片段） |

## 使用示例

- "分镜这个故事" → 读取剧本，按工作流产出 shots.json，校验后生成
- "把 shots.json 做成图" → `take generate images`
- "检查我的分镜" → `take validate`
- "导出分镜表" → `take export storyboard`
- "查一下环境" → `take doctor`
