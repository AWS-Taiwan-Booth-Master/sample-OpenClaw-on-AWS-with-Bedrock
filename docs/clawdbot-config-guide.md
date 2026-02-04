# Clawdbot 設定架構指南

本文件說明 Clawdbot 的設定檔案結構、各檔案用途，以及如何進行設定。

## 設定檔案位置

所有 Clawdbot 設定都存放在 `~/.clawdbot/` 目錄下。

```
~/.clawdbot/
├── clawdbot.json          # 主設定檔（最重要！）
├── clawdbot.json.bak      # 設定備份
├── gateway_token.txt      # Web UI 存取 token
├── exec-approvals.json    # 執行批准記錄
├── update-check.json      # 更新檢查狀態
├── instance_id.txt        # EC2 Instance ID（AWS 部署用）
├── region.txt             # AWS Region（AWS 部署用）
├── setup_status.txt       # 安裝狀態
│
├── agents/                # Agent 設定和對話記錄
│   └── main/
│       ├── agent/
│       │   └── models.json    # Agent 專屬 model 設定
│       └── sessions/
│           ├── *.jsonl        # 對話歷史記錄
│           └── sessions.json  # Session 索引
│
├── credentials/           # 認證資訊
│   ├── discord-allowFrom.json   # Discord 允許的用戶
│   └── discord-pairing.json     # Discord pairing 狀態
│
├── cron/                  # 排程任務
│   └── jobs.json          # Cron jobs 設定
│
├── devices/               # 裝置配對
│   ├── paired.json        # 已配對裝置
│   └── pending.json       # 待配對裝置
│
└── identity/              # 身份識別
    ├── device.json        # 裝置識別資訊
    └── device-auth.json   # 裝置認證
```

---

## 主設定檔：clawdbot.json

這是最重要的設定檔，包含所有核心設定。

### 完整結構範例

```json
{
  "meta": {
    "lastTouchedVersion": "2026.1.24-3",
    "lastTouchedAt": "2026-02-04T04:00:54.788Z"
  },
  "models": {
    "providers": {
      "amazon-bedrock": {
        "baseUrl": "https://bedrock-runtime.us-west-2.amazonaws.com",
        "auth": "aws-sdk",
        "api": "bedrock-converse-stream",
        "models": [
          {
            "id": "global.amazon.nova-2-lite-v1:0",
            "name": "Bedrock Model",
            "reasoning": false,
            "input": ["text", "image"],
            "cost": {
              "input": 0,
              "output": 0
            },
            "contextWindow": 200000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "amazon-bedrock/global.amazon.nova-2-lite-v1:0"
      },
      "compaction": {
        "mode": "safeguard"
      },
      "maxConcurrent": 4,
      "subagents": {
        "maxConcurrent": 8
      }
    }
  },
  "channels": {
    "discord": {
      "enabled": true,
      "token": "<BOT_TOKEN>",
      "groupPolicy": "open"
    }
  },
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "loopback",
    "controlUi": {
      "enabled": true
    },
    "auth": {
      "mode": "token",
      "token": "<GATEWAY_TOKEN>"
    }
  },
  "plugins": {
    "entries": {
      "discord": {
        "enabled": true
      }
    }
  }
}
```

---

## 設定區塊說明

### 1. models - AI 模型設定

```json
"models": {
  "providers": {
    "<provider-name>": {
      "baseUrl": "API endpoint",
      "auth": "認證方式",
      "api": "API 格式",
      "models": [...]
    }
  }
}
```

**支援的 Provider**：
- `amazon-bedrock` - AWS Bedrock
- `anthropic` - Anthropic API
- `openai` - OpenAI API

### 2. agents - Agent 行為設定

```json
"agents": {
  "defaults": {
    "model": {
      "primary": "provider/model-id"
    },
    "compaction": {
      "mode": "safeguard"  // 對話壓縮模式
    },
    "maxConcurrent": 4     // 最大並行數
  }
}
```

### 3. channels - 通訊頻道設定

```json
"channels": {
  "discord": {
    "enabled": true,
    "token": "<BOT_TOKEN>",
    "groupPolicy": "open"  // allowlist | open | denylist
  }
}
```

**groupPolicy 選項**：
| 值 | 說明 |
|---|------|
| `allowlist` | 只回應私訊和 allowlist 中的 Server（預設）|
| `open` | 回應所有 Server 頻道 |
| `denylist` | 回應除了 denylist 以外的所有 Server |

### 4. gateway - Web UI 設定

```json
"gateway": {
  "port": 18789,
  "mode": "local",
  "bind": "loopback",
  "auth": {
    "mode": "token",
    "token": "<TOKEN>"
  }
}
```

### 5. plugins - 插件設定

```json
"plugins": {
  "entries": {
    "discord": { "enabled": true },
    "telegram": { "enabled": false }
  }
}
```

---

## 常用設定指令

### 查看設定

```bash
# 查看特定設定
clawdbot config get agents.defaults.model
clawdbot config get channels.discord

# 查看完整設定檔
cat ~/.clawdbot/clawdbot.json
```

### 修改設定

```bash
# 修改 model
clawdbot config set agents.defaults.model.primary "amazon-bedrock/global.amazon.nova-pro-v1:0"

# 修改 Discord groupPolicy
clawdbot config set channels.discord.groupPolicy open

# 修改後重啟生效
clawdbot daemon restart
```

### 備份與還原

```bash
# 備份
cp ~/.clawdbot/clawdbot.json ~/.clawdbot/clawdbot.json.backup

# 還原
cp ~/.clawdbot/clawdbot.json.backup ~/.clawdbot/clawdbot.json
clawdbot daemon restart
```

---

## 可用的 Bedrock Model ID

| Model | ID | 說明 |
|-------|-----|------|
| Nova 2 Lite | `global.amazon.nova-2-lite-v1:0` | 最便宜，適合簡單任務 |
| Nova Pro | `us.amazon.nova-pro-v1:0` | 平衡性價比 |
| Claude Sonnet 4.5 | `global.anthropic.claude-sonnet-4-5-20250929-v1:0` | 最強能力 |
| Claude Haiku 4.5 | `global.anthropic.claude-haiku-4-5-20251001-v1:0` | 快速便宜 |
| DeepSeek R1 | `us.deepseek.r1-v1:0` | 開源推理模型 |

### 切換 Model 範例

```bash
# 切換到 Claude Sonnet
clawdbot config set agents.defaults.model.primary "amazon-bedrock/global.anthropic.claude-sonnet-4-5-20250929-v1:0"
clawdbot daemon restart
```

---

## 敏感檔案說明

以下檔案包含敏感資訊，請勿外洩：

| 檔案 | 內容 |
|------|------|
| `clawdbot.json` | 包含 Discord Bot Token |
| `gateway_token.txt` | Web UI 存取 Token |
| `credentials/` | 用戶認證資訊 |
| `identity/` | 裝置識別金鑰 |

---

## 設定變更後

大部分設定變更後需要重啟 daemon：

```bash
clawdbot daemon restart
```

某些設定（如 model）可能需要開始新對話才會生效。

---

## 相關文件

- [Discord 設定指南](./discord-setup-guide.md)
- [實作補充說明](./implementation-guide-20260204-7727637.md)
- [Moltbot 官方文件](https://docs.molt.bot/)

---

## 資料來源說明

本文件內容來源分為以下類別：

### ✅ 實測驗證

以下內容來自實際 EC2 檔案系統查詢和操作測試：

- 目錄結構（透過 `ls -laR ~/.clawdbot/` 取得）
- `clawdbot.json` 完整內容（透過 `cat ~/.clawdbot/clawdbot.json` 取得）
- `groupPolicy` 設定效果（實測 Discord Server 頻道回應問題）
- `plugins.entries` 設定（實測 Discord 插件啟用問題）
- CLI 指令 `clawdbot config get/set`、`clawdbot daemon restart`

### 📖 來自 README

- 可用的 Bedrock Model ID 列表
- 基本部署架構

### ⚠️ 推測/待驗證

以下內容是根據檔案結構和命名推測，**尚未有官方文件佐證**：

- `credentials/` 目錄下各檔案的詳細格式
- `identity/` 目錄的完整用途
- `agents/main/sessions/*.jsonl` 的詳細結構
- 部分設定選項的完整列表

如發現錯誤或有官方文件補充，歡迎更新本文件。

---

*最後更新：2026-02-04*
