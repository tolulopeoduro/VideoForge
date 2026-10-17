# Third-party license log

Record every dependency, model, font, and stock source here before it is added (see AGENTS.md).

| Name | Version | Kind (lib/model/font/stock) | License | Commercial use OK? | Notes / link to terms |
|---|---|---|---|---|---|
| zod | ^3.23 | lib | MIT | Yes | |
| immer | ^10.1 | lib | MIT | Yes | |
| fastify | ^5 | lib | MIT | Yes | |
| bullmq | ^5.12 | lib | MIT | Yes | |
| fast-check | 3.22.0 | lib | MIT | Yes | https://github.com/dubzzz/fast-check/blob/main/LICENSE |
| @napi-rs/canvas | 0.1.65 | lib | MIT | Yes | https://github.com/Brooooooklyn/canvas/blob/main/LICENSE |
| open_clip_torch (code) | | lib | MIT | Yes | Weights have separate terms: record the exact checkpoint used |
| OpenCLIP laion2b_s34b_b79k weights | | model | verify | verify | Confirm before shipping |
| FFmpeg | 9.0.2 | binary | LGPL/GPL depending on build | verify | Called as a separate child process (`spawn`); use LGPL-only build (`--disable-gpl`) in production images |
| hexgrad/Kokoro-82M | 1.0 | model | Apache-2.0 | Yes | https://huggingface.co/hexgrad/Kokoro-82M (Apache-2.0 weights) |
| onnx-community/Kokoro-82M-v1.0-ONNX | 1.0 | model | Apache-2.0 | Yes | https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX |
| kokoro | 0.9.4 | lib | Apache-2.0 | Yes | https://github.com/hexgrad/kokoro/blob/main/LICENSE |
| kokoro-js | 1.2.1 | lib | Apache-2.0 | Yes | https://www.npmjs.com/package/kokoro-js (Apache-2.0) |

Verify every row against the upstream license file; this table is a starting point, not legal advice.
