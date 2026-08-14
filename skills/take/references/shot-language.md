# 镜头语言受控词表

> 所有 shot 的 `shotSize` / `angle` / `movement` 必须取自下表。core 的
> zod schema 严格校验，非法值会导致 `take validate` 失败。

## 景别 shotSize（从远到近）

| 值 | 含义 | 用途 |
|---|---|---|
| `extreme-wide` | 大远景 | 环境/史诗感/人物渺小 |
| `wide` | 全景 | 人物全身+环境 |
| `full` | 全身 | 人物完整动作 |
| `medium` | 中景 | 腰部以上，对话/动作 |
| `medium-close` | 中近景 | 胸部以上，情绪初显 |
| `close` | 特写 | 面部，情绪核心 |
| `extreme-close` | 大特写 | 眼/手/物件，极致张力 |

## 角度 angle

| 值 | 含义 | 用途 |
|---|---|---|
| `eye-level` | 平视 | 客观/平等 |
| `low` | 仰拍 | 威严/压迫/英雄化 |
| `high` | 俯拍 | 脆弱/掌控/俯瞰 |
| `dutch` | 斜角 | 失衡/不安/迷幻 |
| `over-shoulder` | 过肩 | 对话关系/视角带入 |
| `aerial` | 航拍 | 大全景/上帝视角 |
| `bird` | 鸟瞰 | 垂直俯视/地图感 |
| `worm` | 虫视 | 贴地仰视/微观压迫 |

## 运镜 movement

| 值 | 含义 | 使用注意 |
|---|---|---|
| `static` | 固定机位 | 默认可选项，稳重 |
| `pan-left` / `pan-right` | 横摇 | 揭示环境/跟随横向动作 |
| `tilt-up` / `tilt-down` | 纵摇 | 揭示高度/主体出现 |
| `dolly-in` | 推近 | 强调/心理侵入 |
| `dolly-out` | 拉远 | 孤立/揭示环境/谢幕 |
| `tracking` | 跟移 | 跟随主体运动 |
| `handheld` | 手持 | 纪实/慌乱/临场感 |
| `crane-up` / `crane-down` | 升降 | 史诗/揭示全景 |
| `zoom-in` / `zoom-out` | 变焦 | 注意：与 dolly 不同，空间感不变 |
| `orbit` | 环绕 | 360° 审视/仪式感 |

## 光影 lighting（自由描述，给出方向+性质）

推荐组合示例：
- `golden-hour backlight` 黄昏逆光
- `neon-glow` 霓虹氛围
- `hard-shadow noir` 硬影黑色电影
- `soft-window daylight` 柔和窗光
- `moonlit blue` 月光冷蓝
- `practical-lamp warm` 台灯暖光
- `studio three-point` 三点布光

## 节奏建议

- 动作戏：medium/close + handheld/tracking + 2-3s
- 文戏：medium/medium-close + static/pan + 4-6s
- 情绪高潮：close/extreme-close + dolly-in + 5-8s
- 转场：wide/extreme-wide + crane + 3s
