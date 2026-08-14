# 端到端示例

## 输入（script.md 片段）

```markdown
# 雨夜

内景 老城区派出所 - 夜

林深（警探，35 岁）独自坐在办公桌前，盯着窗外的大雨。
桌上放着一封没有寄件人的信。他拿起信，犹豫片刻，拆开。
信上只有一行字："她回来了。"

林深的表情从困惑变为警觉。他缓缓放下信，望向窗外——
雨幕中，街对面站着一个模糊的人影。
```

## Agent 分析产出（节拍）

```jsonc
{
  "title": "雨夜",
  "aspectRatio": "16:9",
  "style": "neo-noir, teal-and-orange, 35mm film grain",
  "source": "agent",
  "shots": [
    {
      "id": "beat-001",
      "index": 1,
      "summary": "林深独坐办公室，盯着窗外大雨",
      "purpose": "建立人物状态：疲惫、警惕、被回忆纠缠",
      "emotion": "melancholy"
    },
    {
      "id": "beat-002",
      "index": 2,
      "summary": "发现并拆开匿名信",
      "purpose": "引入核心悬念：'她回来了'",
      "emotion": "uncertainty"
    },
    {
      "id": "beat-003",
      "index": 3,
      "summary": "反应：警觉，望向窗外人影",
      "purpose": "反转预期，把悬念推向外部威胁",
      "emotion": "alarm"
    }
  ]
}
```

## 完整 shots.json（节选，3 拍拆 5 镜头）

```jsonc
{
  "title": "雨夜",
  "aspectRatio": "16:9",
  "style": "neo-noir, teal-and-orange, 35mm film grain",
  "source": "agent",
  "shots": [
    {
      "id": "shot-001",
      "beatId": "beat-001",
      "index": 1,
      "summary": "林深独坐，窗外暴雨，霓虹灯光透过雨幕",
      "durationSec": 5,
      "shotSize": "wide",
      "angle": "eye-level",
      "movement": "static",
      "characters": ["林深"],
      "location": "派出所办公室",
      "lighting": "practical-lamp warm + 窗外冷蓝",
      "tone": "melancholy",
      "imagePrompt": "老城区派出所办公室夜景，一名35岁警探独坐办公桌前望向窗外暴雨，钨丝台灯暖光与窗外冷蓝霓虹对比，wide shot，平视，固定机位，黑色电影风格，青橙色调，35mm胶片颗粒",
      "status": "approved"
    },
    {
      "id": "shot-002",
      "beatId": "beat-002",
      "index": 2,
      "summary": "特写：桌上的匿名信，手伸向它",
      "durationSec": 3,
      "shotSize": "extreme-close",
      "angle": "high",
      "movement": "static",
      "characters": ["林深"],
      "location": "派出所办公室",
      "lighting": "practical-lamp warm",
      "tone": "uncertainty",
      "imagePrompt": "桌面特写：泛黄信封无寄件人，一只有力手掌伸向它，台灯暖光，extreme-close，俯拍，固定机位，浅景深，胶片颗粒",
      "status": "approved"
    },
    {
      "id": "shot-003",
      "beatId": "beat-002",
      "index": 3,
      "summary": "拆信，信上'她回来了'一行字",
      "durationSec": 4,
      "shotSize": "close",
      "angle": "eye-level",
      "movement": "dolly-in",
      "characters": ["林深"],
      "location": "派出所办公室",
      "lighting": "practical-lamp warm",
      "tone": "uncertainty",
      "imagePrompt": "警探手持信纸特写，纸上'她回来了'手写字迹清晰，台灯暖光，close，平视，缓慢推近，黑色电影风格，浅景深",
      "videoPrompt": "镜头从持信手势缓慢推近至字迹，信纸微微颤抖，持续4秒",
      "status": "approved"
    },
    {
      "id": "shot-004",
      "beatId": "beat-003",
      "index": 4,
      "summary": "林深表情：困惑转为警觉",
      "durationSec": 3,
      "shotSize": "medium-close",
      "angle": "eye-level",
      "movement": "static",
      "characters": ["林深"],
      "location": "派出所办公室",
      "lighting": "practical-lamp warm",
      "tone": "alarm",
      "imagePrompt": "35岁警探面部中近景，表情由困惑转为警觉，瞳孔微缩，台灯暖光侧打，medium-close，平视，固定机位，电影感肖像光",
      "status": "approved"
    },
    {
      "id": "shot-005",
      "beatId": "beat-003",
      "index": 5,
      "summary": "望向窗外：雨幕中街对面模糊人影",
      "durationSec": 5,
      "shotSize": "wide",
      "angle": "high",
      "movement": "pan-right",
      "characters": [],
      "location": "派出所窗外街道",
      "lighting": "neon-glow + rain",
      "tone": "alarm",
      "imagePrompt": "雨夜街道全景：霓虹灯映在湿漉漉路面，街对面站着一个模糊人影，俯拍，横摇，青橙色调，黑色电影风格",
      "videoPrompt": "镜头缓缓右摇，雨幕中的人影轮廓逐渐清晰又隐没在霓虹光里，持续5秒",
      "status": "approved"
    }
  ]
}
```

## 生成与导出

```bash
# 无密钥联调
take generate images --mock
take generate video --mock

# 真实生成（配置好环境变量后）
take generate images
take generate video

# 导出人类可读分镜表
take export storyboard
```

## 质量自检清单（Agent 交付前）

- [ ] beat 有 purpose（不是"推动剧情"这种空话）
- [ ] 镜头不连续三个同景别
- [ ] 动作密集处镜头短（2-3s），情绪处镜头长（5-8s）
- [ ] 每个 imagePrompt 含：主体+动作 / 场景 / 镜头语言 / 光影 / 风格
- [ ] 有 videoPrompt 的镜头描述了运动与持续时间
- [ ] 角色名与 characterRefs 一致
- [ ] `take validate` 零错误
