# 素材台账（CREDITS）

> 美术目前仍为 Three.js 基础几何体（待替换）；**音效已接入 CC0 真实采样**。
> 每引入一个文件都在此登记，确保商用合规（详见 [docs/04-assets.md](../../../docs/04-assets.md)）。

## 音效（已接入，CC0）

| 文件 | 类型 | 来源 | 授权 | 处理 |
|------|------|------|------|------|
| audio/weapons/ar.mp3 / smg.mp3 | 步枪/冲锋枪开火 | OpenGameArt《Gunshot Sounds》(SKS 录音) https://opengameart.org/content/gunshot-sounds | CC0 | 裁剪单发 + 标准化 |
| audio/weapons/pistol.mp3 | 手枪开火 | 同上（CZ-52 录音） | CC0 | 裁剪单发 + 标准化 |
| audio/weapons/sniper.mp3 | 狙击开火 | 同上（Mosin Nagant 录音） | CC0 | 裁剪单发 + 标准化 |
| audio/weapons/shotgun.mp3 | 霰弹开火 | 同上（shotgun 录音） | CC0 | 标准化 |
| audio/weapons/reload.mp3 | 换弹 | OpenGameArt《Gun Reload Sound Effects》by Brian MacIntosh https://opengameart.org/content/gun-reload-sound-effects | CC0 | 转码 mp3 |

> 命中/爆头/连杀播报/丧尸吼叫等仍为 WebAudio 程序化合成（合成音，无版权问题），后续可按需替换。
> 采样加载失败时自动回退到程序化合成（见 `client/src/audio.ts`）。

## 美术（待替换）

| 文件 | 类型 | 计划来源 | 授权 |
|------|------|----------|------|
| （计划）models/weapons/*.glb | 武器模型 | Quaternius / Kenney | CC0 |
| （计划）models/zombies/*.glb | 丧尸模型 | Quaternius | CC0 |

## 合规底线
- ✅ 允许：CC0 / CC-BY（署名）/ 明确商用授权 / 原创 / 可商用 AI 生成
- ❌ 禁止：CF/CS/COD 等游戏提取素材、来源不明素材、CC-BY-NC（禁商用）
