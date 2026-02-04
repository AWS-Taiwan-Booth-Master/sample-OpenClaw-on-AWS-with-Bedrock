# OpenClaw 進階功能指南

本文件說明 OpenClaw (Moltbot) 的進階功能，包括 Multi-Agent 路由、Workspace 設定、Skills 系統、Session 管理等。這些功能在官方 README 中較少著墨，但對於進階使用者非常重要。

## 目錄

1. [架構概覽](#架構概覽)
2. [Agent 系統](#agent-系統)
3. [Session 管理](#session-管理)
4. [Skills 系統](#skills-系統)
5. [Memory 系統](#memory-系統)
6. [Workspace 設定](#workspace-設定)
7. [Multi-Channel 路由](#multi-channel-路由)
8. [Cron 排程任務](#cron-排程任務)
9. [Canvas 視覺化輸出](#canvas-視覺化輸出)
10. [Node 遠端控制](#node-遠端控制)
11. [安全與權限](#安全與權限)

---

## 架構概覽

### OpenClaw 核心架構

```mermaid
flowchart TB
    subgraph Channels["📱 Messaging Channels"]
        WhatsApp["WhatsApp"]
        Telegram["Telegram"]
        Discord["Discord"]
        Slack["Slack"]
        iMessage["iMessage"]
    end
    
    subgraph Gateway["🚪 Gateway Server (ws://127.0.0.1:18789)"]
        Router["Channel Router"]
        SessionMgr["Session Manager"]
        LaneQueue["Lane-based Queue"]
    end
    
    subgraph AgentRunner["🤖 Agent Runner"]
        ModelSelector["Model Selector"]
        PromptBuilder["Prompt Builder"]
        ToolExecutor["Tool Executor"]
    end
    
    subgraph Storage["💾 Storage"]
        Config["clawdbot.json"]
        Sessions["sessions/*.jsonl"]
        Memory["memory/*.md"]
        Skills["skills/"]
    end
    
    subgraph External["☁️ External Services"]
        Bedrock["Amazon Bedrock"]
        Anthropic["Anthropic API"]
        OpenAI["OpenAI API"]
    end
    
    Channels --> Router
    Router --> SessionMgr
    SessionMgr --> LaneQueue
    LaneQueue --> AgentRunner
    AgentRunner --> External
    AgentRunner --> Storage
```

### 訊息處理流程

1. **Channel Adapter** - 接收並標準化訊息格式
2. **Gateway Server** - 路由到正確的 Session
3. **Lane-based Queue** - 管理並行請求（預設串行，可選並行）
4. **Agent Runner** - 處理 Model 選擇、Prompt 建構、Tool 執行
5. **Response** - 回傳結果到原始 Channel

---

## Agent 系統

### Agent 設定結構

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "amazon-bedrock/global.amazon.nova-2-lite-v1:0",
        "fallback": "amazon-bedrock/us.amazon.nova-pro-v1:0"
      },
      "compaction": {
        "mode": "safeguard"
      },
      "maxConcurrent": 4,
      "subagents": {
        "maxConcurrent": 8
      }
    }
  }
}
```

### Agent 設定選項

| 設定 | 說明 | 預設值 |
|------|------|--------|
| `model.primary` | 主要使用的 Model | - |
| `model.fallback` | 主 Model 失敗時的備用 | - |
| `compaction.mode` | 對話壓縮模式 | `safeguard` |
| `maxConcurrent` | 最大並行 Agent 數 | 4 |
| `subagents.maxConcurrent` | 子 Agent 最大並行數 | 8 |

### Compaction 模式

| 模式 | 說明 |
|------|------|
| `safeguard` | 接近 context window 上限時自動壓縮 |
| `aggressive` | 積極壓縮以節省 token |
| `none` | 不壓縮（可能導致 context overflow）|

### 切換 Model

```bash
# 查看當前 model
clawdbot config get agents.defaults.model

# 切換到 Claude Sonnet
clawdbot config set agents.defaults.model.primary "amazon-bedrock/global.anthropic.claude-sonnet-4-5-20250929-v1:0"

# 設定 fallback model
clawdbot config set agents.defaults.model.fallback "amazon-bedrock/global.amazon.nova-pro-v1:0"

# 重啟生效
clawdbot daemon restart
```

---

## Session 管理

### Session 概念

OpenClaw 使用 Session 來管理對話上下文：

- **Main Session** - 私訊（DM）使用的 Session
- **Group Session** - Server/群組頻道使用的 Session
- 每個 Session 有獨立的對話歷史和 context

### Session 儲存結構

```
~/.clawdbot/agents/main/sessions/
├── sessions.json          # Session 索引
├── <session-id>.jsonl     # 對話歷史（JSON Lines 格式）
└── ...
```

### Session 指令

**在聊天中使用：**

| 指令 | 功能 |
|------|------|
| `/status` | 顯示當前 Session 狀態（model、tokens、cost）|
| `/new` 或 `/reset` | 開始新對話（清除 context）|
| `/think high` | 啟用深度思考模式 |
| `/help` | 顯示可用指令 |

**CLI 指令：**

```bash
# 列出所有 sessions
clawdbot sessions list

# 查看特定 session
clawdbot sessions preview <session-id>

# 刪除 session
clawdbot sessions delete <session-id>

# 壓縮 session（減少 token 使用）
clawdbot sessions compact <session-id>
```

---

## Skills 系統

### Skills 概念

Skills 是 OpenClaw 的模組化能力擴展系統。每個 Skill 是一個資料夾，包含 `SKILL.md` 檔案來定義功能。

### Skills 類型

| 類型 | 說明 | 位置 |
|------|------|------|
| **Bundled Skills** | 內建技能（50+）| 安裝目錄 |
| **Managed Skills** | 從 ClawdHub 安裝 | `~/.clawdbot/skills/` |
| **Workspace Skills** | 專案特定技能 | `./clawd/skills/` |

### 內建 Skills 範例

- **Email** - 郵件處理
- **Calendar** - 行事曆管理
- **Browser** - 網頁自動化
- **GitHub** - GitHub 整合
- **Smart Home** - 智慧家居控制
- **Voice** - 語音處理

### Skills 指令

```bash
# 列出可用 skills
clawdbot skills list

# 安裝 skill
clawdbot skills install <skill-name>

# 查看已安裝 skills
clawdbot skills installed

# 移除 skill
clawdbot skills remove <skill-name>
```

### 自訂 Skill 結構

```
my-skill/
├── SKILL.md          # 必要：技能說明和指令
├── tools/            # 可選：自訂工具
│   └── my-tool.ts
└── config.json       # 可選：設定檔
```

---

## Memory 系統

### Memory 概念

OpenClaw 使用兩層記憶系統：

1. **Session Memory** - 對話歷史（`.jsonl` 檔案）
2. **Long-term Memory** - 持久記憶（`memory/*.md` 檔案）

### Memory 儲存結構

```
~/.clawdbot/agents/main/
├── sessions/
│   └── *.jsonl           # 對話歷史
└── workspace/
    └── memory/
        ├── MEMORY.md     # 主記憶檔
        └── *.md          # 分類記憶
```

### Memory 搜尋機制

OpenClaw 使用混合搜尋：

- **Vector Search** - 語意相似度（SQLite + 向量）
- **Keyword Search** - 關鍵字匹配（FTS5）

### 使用 Memory

**讓 Agent 記住事情：**

```
你：記住我喜歡深色模式
Agent：好的，我已經記下你偏好深色模式。
```

**查詢記憶：**

```
你：我之前說過什麼偏好？
Agent：根據我的記憶，你偏好深色模式...
```

---

## Workspace 設定

### Workspace 概念

Workspace 是 OpenClaw 的工作目錄，包含專案特定的設定、Skills 和 Prompts。

### Workspace 結構

```
~/clawd/                    # 預設 Workspace
├── system.md              # 系統 Prompt（自訂 Agent 行為）
├── skills/                # Workspace Skills
│   └── my-skill/
├── memory/                # Workspace Memory
│   └── *.md
└── config.json            # Workspace 設定
```

### 自訂系統 Prompt

建立 `~/clawd/system.md`：

```markdown
你是我的個人助理。請遵循以下規則：

1. 回答要簡潔有力
2. 使用繁體中文
3. 遇到不確定的事情要先確認
4. 重要操作前要先詢問確認
```

---

## Multi-Channel 路由

### Channel 設定

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "<BOT_TOKEN>",
      "groupPolicy": "open"
    },
    "telegram": {
      "enabled": true,
      "token": "<BOT_TOKEN>"
    }
  }
}
```

### groupPolicy 選項

| 值 | 行為 |
|---|------|
| `allowlist` | 只回應私訊 + allowlist 中的群組（預設）|
| `open` | 回應所有群組 |
| `denylist` | 回應除了 denylist 以外的所有群組 |

---

## Cron 排程任務

### Cron 概念

OpenClaw 支援排程任務，可以定時執行指令。

### Cron 設定

```bash
# 添加 cron job
clawdbot cron add "0 8 * * *" "每日簡報：總結行事曆和前 5 封郵件"

# 列出 cron jobs
clawdbot cron list

# 移除 cron job
clawdbot cron remove <job-id>
```

### Cron 表達式

```
┌───────────── 分鐘 (0 - 59)
│ ┌───────────── 小時 (0 - 23)
│ │ ┌───────────── 日 (1 - 31)
│ │ │ ┌───────────── 月 (1 - 12)
│ │ │ │ ┌───────────── 星期 (0 - 7, 0 和 7 都是週日)
│ │ │ │ │
* * * * *
```

---

## Canvas 視覺化輸出

### Canvas 概念

Canvas 是 OpenClaw 的視覺化輸出功能，讓 Agent 可以生成和展示互動式 HTML 內容。

### Canvas 目錄結構

```
~/clawd/
└── canvas/
    ├── index.html        # 主要 Canvas 頁面
    ├── dashboard.html    # 自訂 Dashboard
    └── *.html            # 其他視覺化內容
```

### Canvas 用途

| 用途 | 說明 |
|------|------|
| **互動式報告** | Agent 生成的數據報告，支援互動操作 |
| **Dashboard** | 即時監控面板，顯示系統狀態 |
| **資料視覺化** | 圖表、圖形等視覺化呈現 |

---

## Node 遠端控制

### Node 概念

Clawdbot Node 是遠端控制客戶端應用程式，讓你可以從 iPhone/iPad/Mac 等設備連接到 Gateway Server。

### Node 功能

| 功能 | 說明 |
|------|------|
| **遠端對話** | 從手機直接與 Gateway 上的 Agent 對話 |
| **推送通知** | 收到訊息時手機會通知 |
| **多設備同步** | 多個 Node 可以連到同一個 Gateway |
| **查看 Canvas** | 在手機上查看 Agent 生成的視覺化內容 |

### 配對步驟

1. **在設備上安裝 Node App**
2. **開啟 App，輸入 Gateway 地址**
3. **App 會顯示 Pairing Code**
4. **在 Gateway 上執行批准**：
   ```bash
   clawdbot pairing approve node <PAIRING_CODE>
   ```

---

## 安全與權限

### 執行批准系統

OpenClaw 使用 allowlist 系統管理指令執行權限。

### 啟用 Bash Commands

```bash
# 啟用（允許 Agent 執行 shell 指令）
clawdbot config set commands.bash true

# 停用
clawdbot config set commands.bash false

clawdbot daemon restart
```

⚠️ **安全提醒**：啟用 `commands.bash` 後，Agent 可以在主機上執行 shell 指令。請確保你了解風險。

### Docker Sandbox

OpenClaw 支援在 Docker sandbox 中執行指令，提供額外的隔離層：

```bash
# 啟用 Docker sandbox
clawdbot config set exec.sandbox docker
```

---

## AWS Bedrock 特定設定

### Model 切換策略

```bash
# 日常任務使用 Nova Lite（便宜）
clawdbot config set agents.defaults.model.primary "amazon-bedrock/global.amazon.nova-2-lite-v1:0"

# 複雜任務使用 Claude Sonnet
clawdbot config set agents.defaults.model.primary "amazon-bedrock/global.anthropic.claude-sonnet-4-5-20250929-v1:0"
```

### 成本優化建議

| 任務類型 | 建議 Model | 原因 |
|---------|-----------|------|
| 簡單問答 | Nova 2 Lite | 最便宜 |
| 日常任務 | Nova Pro | 平衡性價比 |
| 複雜推理 | Claude Sonnet | 最強能力 |
| 程式碼生成 | Claude Sonnet | 程式碼品質最佳 |

---

## 相關文件

- [Discord 設定指南](../setup/discord-setup-guide.md)
- [Clawdbot 設定架構指南](./clawdbot-config-guide.md)
- [AWS 網路架構說明](../architecture/aws-network-architecture.md)

---

## 外部資源

- [OpenClaw 官方 GitHub](https://github.com/openclaw/openclaw)
- [Moltbot 官方文件](https://docs.molt.bot/)
- [Amazon Bedrock 文件](https://docs.aws.amazon.com/bedrock/)

---

*最後更新：2026-02-05*
