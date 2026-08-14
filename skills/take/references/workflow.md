# take 工作流详解

## 输入形态

| 输入 | 处理 |
|---|---|
| `script.md` 文件 | 直接读取，逐场景分析 |
| 用户粘贴的文本 | 先写入 `script.md` 再分析（一切皆文件） |
| 已有 `shots.json` | 跳过分析，直接校验/生成 |

## 步骤 2：节拍分解（Agent 自身模型）

对剧本逐场景/逐场戏识别 beat。每个 beat 输出：

```json
{ "id": "beat-001", "index": 1, "summary": "一句话：发生了什么", "purpose": "叙事功能：为什么存在", "emotion": "tension" }
```

要点：
- 节拍数量：短片（<3 分钟）5-15 拍；长片按场景逐段拆，宁多勿漏。
- `purpose` 不要写"推动剧情"，要写具体功能（如"建立主角的逃避机制""反转观众的预期"）。

## 步骤 3：镜头设计（Agent 自身模型）

对每个 beat 拆 1-5 个 shot。判断依据：
- 信息量：一个镜头只说一件事。
- 节奏：动作密集处镜头短（2-3s），情绪处镜头长（5-8s）。
- 景别变化：避免连续三个同景别；对话用中景/近景交替，环境用全景交代。

每个 shot 必须包含（缺一不可，schema 强校验）：
- `shotSize` / `angle` / `movement`（受控词表）
- `summary`：画面里发生什么
- `durationSec`：目标时长
- `characters`：在场角色（与项目资产一致）
- `imagePrompt`：GPT-image-2 友好的完整画面提示词

## 步骤 4：提示词编写规范

### imagePrompt（图像，GPT-image-2）

结构：`[主体与动作] + [场景与环境] + [镜头语言] + [光影色调] + [风格一致性]`

示例：
```
夜晚的雨巷，一名穿驼色风衣的侦探独自走来，湿漉漉的石板路倒映霓虹灯光，
wide shot，低角度，固定机位，电影感霓虹色调，黑色电影风格，35mm 镜头，胶片颗粒
```

要点：
- 镜头语言词（wide shot / low angle / dolly-in 等）放在中段，风格词收尾。
- 涉及角色一致性时引用角色参考（`visual.characterRefs`），如 `detective: assets/ref-detective.png`。

### videoPrompt（视频，Seedance 2.x）

在 imagePrompt 基础上补充**运动与时间**：
```
[同 imagePrompt] + 镜头缓慢推进，雨滴落在镜头前，侦探脚步溅起水花，持续 5 秒
```

要点：
- 明确运动主体、运动方式、持续时间（≤5s 效果最佳）。
- 首帧图（firstFrameUrl）存在时，videoPrompt 描述"从首帧开始的运动"。

## 步骤 5-7：校验、生成、导出

- 校验：`take validate`（agent 环境也可用 MCP `validate_shots`）
- 生成：`take generate images --mock`（无密钥调试）→ 真实密钥后去掉 `--mock`
- 导出：`take export storyboard`，审阅后如需修改，直接编辑 storyboard.md 再 `take export import` 回写

## 九宫格（可选进阶）

单镜头如需多机位预演，参考 core 的 `buildShotGrid`：每个 shot 可派生 3x3
矩阵（背景/主体/前景 × 左/中/右），九格提示词在 imagePrompt 基础上追加
`background plane, center position` 等修饰。Agent 可按需覆盖个别格子。
