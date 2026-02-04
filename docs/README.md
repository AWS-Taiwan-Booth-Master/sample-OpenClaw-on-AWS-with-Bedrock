# 補充文件索引

本目錄包含 Moltbot on AWS with Bedrock 專案的補充文件，記錄實際部署過程中的發現、問題排除和進階功能說明。這些內容是原始 README 的延伸，基於實測驗證。

**維護者**: FDE Team  
**最後更新**: 2026-02-05

---

## 📁 文件架構

```
docs/
├── README.md                              # 本文件 - 文件索引
│
├── architecture/                          # 🏗️ 架構說明
│   ├── aws-network-architecture.md        # AWS 網路架構（VPC/Subnet/Endpoint）
│   └── webui-ssm-architecture.md          # Web UI / SSM 端口轉發架構
│
├── features/                              # ⚙️ 功能說明
│   ├── openclaw-advanced-features-guide.md # OpenClaw 進階功能指南
│   └── clawdbot-config-guide.md           # Clawdbot 設定架構指南
│
└── setup/                                 # 🔧 安裝技巧
    └── discord-setup-guide.md             # Discord Bot 完整設定指南
```

---

## 📋 文件說明

### 🏗️ 架構 (architecture/)

| 文件 | 用途 | 適合讀者 |
|------|------|---------|
| [aws-network-architecture.md](./architecture/aws-network-architecture.md) | AWS 網路架構圖（VPC/Subnet/Endpoint/IAM） | 想了解 AWS 架構的使用者 |
| [webui-ssm-architecture.md](./architecture/webui-ssm-architecture.md) | SSM 端口轉發原理、Web UI 存取機制 | 想了解安全架構的使用者 |

### ⚙️ 功能 (features/)

| 文件 | 用途 | 適合讀者 |
|------|------|---------|
| [openclaw-advanced-features-guide.md](./features/openclaw-advanced-features-guide.md) | Agent/Skills/Memory/Canvas/Node 等進階功能 | 想使用進階功能的使用者 |
| [clawdbot-config-guide.md](./features/clawdbot-config-guide.md) | 設定檔結構、Gateway API 分析、Web UI 架構 | 想深入了解系統的開發者 |

### 🔧 安裝技巧 (setup/)

| 文件 | 用途 | 適合讀者 |
|------|------|---------|
| [discord-setup-guide.md](./setup/discord-setup-guide.md) | Discord Bot 完整設定步驟，包含 README 未提及的關鍵設定 | 想整合 Discord 的使用者 |

---

## ⚠️ 原始 README 需要修正的地方

### 1. VPC Endpoints 數量和成本錯誤

**README 原文** (Cost Breakdown 章節):
```markdown
| VPC Endpoints | 3 endpoints | $21.60 |
| **Subtotal** | | **$53-58** |
```

**實際情況**：CloudFormation template 定義了 **4 個** VPC Endpoints：

| Endpoint | Service | 用途 |
|----------|---------|------|
| BedrockRuntimeVPCEndpoint | bedrock-runtime | Bedrock API 呼叫 |
| SSMVPCEndpoint | ssm | SSM 服務 |
| SSMMessagesVPCEndpoint | ssmmessages | SSM Session Manager 訊息 |
| EC2MessagesVPCEndpoint | ec2messages | SSM Agent 通訊 |

**SSM Session Manager 需要 3 個 endpoints（ssm + ssmmessages + ec2messages）才能正常運作。**

**正確成本估算**：
```markdown
| VPC Endpoints | 4 endpoints | $28.80 |
| **Subtotal** | | **$60-66** |
```

---

### 2. Discord 設定步驟不完整

**README 原文**：
```markdown
1. Create Bot: Visit Discord Developer Portal
2. Invite Bot: Generate invite URL with permissions
3. Configure: In Web UI, add Discord channel with bot token
4. Test: Mention your bot in a Discord channel
```

**缺少的關鍵步驟**：

| 步驟 | README 提及 | 實際需要 |
|------|:-----------:|:--------:|
| 啟用 Discord 插件 | ❌ | `clawdbot plugins enable discord` |
| 啟用 MESSAGE CONTENT INTENT | ⚠️ 簡略 | 必須在 Developer Portal 啟用 |
| 設定 groupPolicy | ❌ | 預設 `allowlist` 導致 Server 頻道沒反應 |
| 用戶 pairing approve | ❌ | 用戶首次使用需要批准 |
| Web UI 配置 | ❌ 說可以 | 實際顯示 "schema unavailable"，需用 CLI |

**詳細說明請參考**：[discord-setup-guide.md](./setup/discord-setup-guide.md)

---

### 3. 第三方模型權限說明不足

**README 原文**：
```markdown
> Before deploying, enable Bedrock models in Bedrock Console
```

**缺少的說明**：使用 Claude、DeepSeek、Llama 等第三方模型需要 AWS Marketplace 權限。

| Model | 需要 Marketplace 權限 |
|-------|:--------------------:|
| Amazon Nova (所有版本) | ❌ 不需要 |
| Anthropic Claude (所有版本) | ✅ 需要 |
| DeepSeek R1 | ✅ 需要 |
| Meta Llama | ✅ 需要 |

---

## 🔗 相關連結

- [專案 README](../README.md)
- [Moltbot 官方文件](https://docs.molt.bot/)
- [Amazon Bedrock 文件](https://docs.aws.amazon.com/bedrock/)
- [Discord Developer Portal](https://discord.com/developers/applications)

---

*最後更新：2026-02-05*
