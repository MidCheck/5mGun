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

## 美术（已接入）

| 文件 | 类型 | 来源 | 授权 |
|------|------|------|------|
| models/characters/zombie.glb | 角色骨骼动画模型（丧尸绿色 / 玩家按队伍着色复用同一模型） | RobotExpressive by Tomás Laulhé（修改 Don McCurdy），three.js 示例 https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive | **CC0** |
| textures/ground.jpg | 地面（沥青） | Poly Haven `asphalt_02` https://polyhaven.com/a/asphalt_02 | **CC0** |
| textures/wall.jpg | 墙面（混凝土） | Poly Haven `concrete_wall_008` | **CC0** |
| textures/metal.jpg | 集装箱（金属板） | Poly Haven `metal_plate` | **CC0** |
| textures/sky.hdr | HDRI 天空盒 + 环境光照 | Poly Haven `qwantani_puresky` https://polyhaven.com/a/qwantani_puresky | **CC0** |

> 武器视图模型暂为程序化几何体（多部件步枪），后续可接入 CC0 枪械 GLB。
> 注：曾下载 three.js 的 Soldier.glb 作玩家模型，但其授权未明确标注，为合规起见已移除，玩家改用 CC0 的 RobotExpressive（按队伍着色）。
> 天空为程序化渐变着色器（无版权问题）。

## 合规底线
- ✅ 允许：CC0 / CC-BY（署名）/ 明确商用授权 / 原创 / 可商用 AI 生成
- ❌ 禁止：CF/CS/COD 等游戏提取素材、来源不明素材、CC-BY-NC（禁商用）
