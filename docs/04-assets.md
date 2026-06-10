# 04 · 美术与音效素材方案

> 版本 v0.1 · 状态：待评审
> 原则：**只用 CC0 / CC-BY / 明确商用授权 / 原创素材**，做出"接近 CF 的听感与手感"，但**绝不使用 CF/CS 等游戏的提取素材**（侵权风险）。每个素材登记来源与授权，建立台账。

---

## 1. 合规底线

| 允许 | 禁止 |
|---|---|
| CC0（公共领域，最省心） | 从 CF/CS/COD 等游戏中提取的模型/音效/贴图 |
| CC-BY（署名即可商用） | 来源不明、无授权的"网图/网音" |
| 明确标注"商用免费"的素材库 | CC-BY-NC（禁商用，本项目若商用不可用） |
| 自绘 / 自录 / AI 生成（确认授权可商用） | 含他人商标/角色 IP 的素材 |

> **CC-BY-NC（非商用）** 要特别警惕：若项目商用则不可用，原型期可临时用但必须标记替换。

---

## 2. 素材清单与来源

### 2.1 音效（爽点核心，重点投入）

| 需求 | 推荐来源（CC0/商用友好） |
|---|---|
| 枪声（开火/远近/室内） | **Freesound.org**（按 CC0 过滤）、**OpenGameArt**、**Sonniss GDC 免费音效包**（商用免费，体量大） |
| 换弹/上膛机械声 | Freesound、Sonniss |
| 命中/爆头确认音 | Freesound + 自行混音叠加 |
| 中弹/受伤、丧尸吼叫 | Freesound、OpenGameArt |
| 连杀语音播报 | **原创配音**（自录或合规 TTS）做"双杀/三杀…"，避免直接抄 CF 语音 |
| 环境/BGM | **incompetech**(Kevin MacLeod, CC-BY)、OpenGameArt |

> 做法：从 CC0 库选基底 → 用 Audacity/DAW 叠加、EQ、加混响，调出"CF 那种清脆带劲"的听感。**听感靠后期，不靠扒原音。**

### 2.2 3D 模型

| 需求 | 推荐来源 |
|---|---|
| 武器模型（枪械） | **Quaternius**(CC0)、**Kenney**(CC0)、Sketchfab 按 CC 过滤、itch.io 免费枪包 |
| 角色（玩家/丧尸） | Quaternius（有低多边形角色/怪物 CC0）、Mixamo（角色+动画，Adobe 免费可商用） |
| 场景道具（集装箱/掩体/街景） | Kenney、Quaternius、Poly Pizza(CC0 聚合) |
| 角色动画（走/跑/换弹/死亡） | **Mixamo**（免费、可商用、自动绑定） |

> 风格统一建议：首期走 **低多边形/半写实**，性能友好、移动端吃得消、风格统一好把控。

### 2.3 贴图 / 材质

- **ambientCG**(CC0)、**Poly Haven**(CC0)：PBR 材质、HDRI 环境光，全部 CC0。
- 纹理图集化、压缩（KTX2/basis）以控包体。

### 2.4 特效 / UI

| 需求 | 来源/做法 |
|---|---|
| 枪口火光、爆血、粒子 | Kenney 粒子包、自制 sprite 序列帧 / Three.js 粒子 |
| HitMarker / 准星 / HUD 图标 | **Kenney UI/Crosshair 包**(CC0)、自绘 SVG |
| HEADSHOT 飘字 / 击杀图标 | 自绘（字体 + 图标），用开源字体 |
| 字体 | **Google Fonts**（开源可商用），中文用思源黑体/站酷等开源字体 |

---

## 3. 主要素材库速查

| 库 | 内容 | 授权 |
|---|---|---|
| Kenney.nl | 模型/UI/音效/粒子 | CC0 |
| Quaternius | 低多边形模型/角色/怪物 | CC0 |
| Poly Haven | HDRI/材质/模型 | CC0 |
| ambientCG | PBR 材质/HDRI | CC0 |
| Poly Pizza | 模型聚合 | CC0/标注 |
| Freesound | 音效 | 混合（按 CC0/CC-BY 过滤）|
| Sonniss GDC Bundle | 大型音效包 | 商用免费 |
| incompetech | 配乐 | CC-BY |
| Mixamo | 角色+动画 | 免费可商用 |
| Google Fonts | 字体 | 开源（OFL/Apache）|
| Sketchfab / itch.io | 模型/素材包 | **逐个核对授权** |

---

## 4. 工作流程

1. **占位先行**：M0–M2 用最简几何体/占位音效（来自 Kenney/Freesound CC0），不卡进度。
2. **统一规范**：定下风格（低多边形/半写实）、尺寸单位、命名、目录结构。
3. **正式替换**：M3 起逐步换正式素材，听感/手感重点打磨枪声与爆头反馈。
4. **登记台账**：每个素材记录到 `assets/CREDITS.md`（名称/来源链接/作者/授权/是否需署名）。
5. **上线前审计**：清理所有 NC/不明授权素材，确保全部商用合规，生成署名页。

---

## 5. 素材目录结构（建议）

```
client/public/assets/
  models/      weapons/  characters/  zombies/  props/
  textures/
  audio/       weapons/  ui/  zombies/  voice/  music/
  fx/          particles/  sprites/
  ui/          icons/  crosshairs/  fonts/
  CREDITS.md   ← 素材台账（来源/作者/授权）
```

---

## 6. 台账模板（`assets/CREDITS.md`）

```
| 文件 | 类型 | 来源链接 | 作者 | 授权 | 需署名 |
|------|------|----------|------|------|--------|
| audio/weapons/ar_fire.wav | 音效 | freesound.org/... | xxx | CC0 | 否 |
| models/weapons/ar.glb | 模型 | quaternius.com/... | Quaternius | CC0 | 否 |
```

---

## 7. 风险提示

- **"CF 风格" ≠ "CF 素材"**：我们复刻的是**听感/手感/反馈节奏**，不是文件本身。任何提取自商业游戏的资源一律不用。
- AI 生成素材需确认所用工具的商用授权条款。
- Sketchfab/itch.io 上素材授权**逐个核对**，别假设免费=可商用。
- 上线前务必完成素材审计与署名页。
