# 模型路由与 failover

## 原则

1. **文本/剧本分析：Agent 自身模型**。不配置、不调用任何额外 LLM API。
2. **图像：GPT-image-2**（主）。能力显著强于 Gemini 图像模型。
3. **视频：Seedance 2.0 / 2.5**（主）→ **Minimax H3**（备）。
4. **Sora2 已退出市场，本工具不支持**。其他视频模型（如旧版 Wan/Veo 路径）
   不具备竞争力，默认不路由。

## 环境变量契约

| 变量 | 用途 | 默认 |
|---|---|---|
| `TAKE_IMAGE_API_KEY` | GPT-image-2 密钥 | — |
| `TAKE_IMAGE_BASE_URL` | 图像端点（OpenAI 兼容） | `https://api.openai.com/v1` |
| `TAKE_IMAGE_MODEL` | 图像模型 | `gpt-image-2` |
| `TAKE_VIDEO_API_KEY` | Seedance 密钥 | — |
| `TAKE_VIDEO_BASE_URL` | Seedance 端点 | Volcengine Ark v3 |
| `TAKE_VIDEO_MODEL` | 视频模型 | `seedance-2.0` |
| `TAKE_FALLBACK_VIDEO_API_KEY` | Minimax H3 密钥 | — |
| `TAKE_FALLBACK_VIDEO_BASE_URL` | Minimax 端点 | `https://api.minimaxi.com/v1` |
| `TAKE_FALLBACK_VIDEO_MODEL` | 备用视频模型 | `minimax-h3` |

## 路由行为

- 主 provider 抛错（网络/鉴权/限流）→ 自动切换 fallback。
- 视频主链路：Seedance 2.x；若返回失败 → Minimax H3。
- 图像主链路：GPT-image-2（当前无 fallback，后续可按需加）。
- `take doctor` 可查看各 provider 配置状态与连通性。

## 升级模型

模型 ID 只出现在配置层，不进业务代码：

```bash
# 升级到 Seedance 2.5
export TAKE_VIDEO_MODEL=seedance-2.5
# 或写入 take.config.json 的 video.model
```

## 为什么这样路由

| 能力 | 选择 | 原因 |
|---|---|---|
| 文本 | Agent 自身 | 零额外成本、零延迟、上下文无缝 |
| 图像 | GPT-image-2 | 画质/指令遵循/一致性最佳 |
| 视频 | Seedance 2.x | 主流、质量与成本平衡、生态活跃 |
| 视频备 | Minimax H3 | 可用性/风格差异化，作为应急通道 |
