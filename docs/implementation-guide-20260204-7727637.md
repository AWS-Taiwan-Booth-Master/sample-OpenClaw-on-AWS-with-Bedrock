# Implementation Guide - 實測補充說明

**基於版本**: Git Commit `7727637`  
**測試日期**: 2026-02-04  
**測試環境**: AWS us-west-2, Account 118903272200

---

## 概述

本文件記錄在實際部署 Moltbot on AWS with Bedrock 過程中，發現 README 和官方文件未提及或說明不清楚的部分。這些是經過實測驗證的正確做法。

---

## 1. Discord 插件預設是停用的

### README 說的
> In Web UI, add Discord channel with bot token

### 實際情況
Web UI 顯示 **"Channel config schema unavailable"**，無法透過 UI 配置。

### 原因
Discord 插件預設是 **disabled** 狀態。

### 正確做法
```bash
# 先啟用插件
clawdbot plugins enable discord

# 再用 CLI 添加 channel
clawdbot channels add --channel discord --token <BOT_TOKEN>
```

---

## 2. Privileged Gateway Intents 必須手動啟用

### README 說的
> Enable intents: Message Content, Server Members

### 實際情況
README 只是簡單帶過，沒有強調這是 **必要步驟**，也沒說明在哪裡設定。

### 正確做法
1. 前往 [Discord Developer Portal](https://discord.com/developers/applications)
2. 選擇你的 Application → 左側選單點 **Bot**
3. 往下滾動到 **Privileged Gateway Intents**
4. 啟用以下三個：
   - ✅ PRESENCE INTENT
   - ✅ SERVER MEMBERS INTENT
   - ✅ **MESSAGE CONTENT INTENT** ← 最重要！
5. 點擊 **Save Changes**

```
⚠️ 如果沒有啟用 MESSAGE CONTENT INTENT，Bot 將完全無法讀取訊息內容！
```

---

## 3. groupPolicy 預設值導致 Server 頻道沒反應

### README 說的
（完全沒提到）

### 實際情況
- Bot 私訊（DM）可以正常回應 ✅
- Bot 在 Server 頻道被 @ 時完全沒反應 ❌

### 原因
`channels.discord.groupPolicy` 預設值是 `allowlist`，而 `allowlist` 是空的。

這表示 Bot 只會回應：
- 私訊
- 明確列在 allowlist 中的 Server

### 正確做法
```bash
# 檢查當前設定
clawdbot config get channels.discord

# 設定為 open（回應所有 Server）
clawdbot config set channels.discord.groupPolicy open

# 重啟生效
clawdbot daemon restart
```

### groupPolicy 選項
| 值 | 行為 |
|---|------|
| `allowlist` | 只回應私訊 + allowlist 中的 Server（預設）|
| `open` | 回應所有 Server |
| `denylist` | 回應除了 denylist 以外的所有 Server |

---

## 4. 用戶需要 Pairing Approve

### README 說的
（完全沒提到）

### 實際情況
用戶第一次 @ Bot 時，會收到：
```
Clawdbot: access not configured. Your Discord user id: 123456789
Pairing code: ABC12XYZ
Ask the bot owner to approve with: clawdbot pairing approve discord <code>
```

### 正確做法
```bash
clawdbot pairing approve discord <PAIRING_CODE>
```

---

## 5. SSM send-command 執行 clawdbot 需要特殊處理

### README 說的
（沒有提供 SSM send-command 的範例）

### 實際情況
直接執行 `clawdbot` 會顯示 `command not found`。

### 原因
1. clawdbot 是透過 nvm 安裝的，需要先 source nvm
2. systemd user service 需要 `XDG_RUNTIME_DIR` 環境變數

### 正確做法

**一般指令：**
```bash
aws ssm send-command \
  --instance-ids "<INSTANCE_ID>" \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["sudo -u ubuntu bash -c \". /home/ubuntu/.nvm/nvm.sh && clawdbot <COMMAND>\""]' \
  --region us-west-2
```

**重啟 daemon：**
```bash
aws ssm send-command \
  --instance-ids "<INSTANCE_ID>" \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["sudo loginctl enable-linger ubuntu; sudo -u ubuntu XDG_RUNTIME_DIR=/run/user/$(id -u ubuntu) bash -c \". /home/ubuntu/.nvm/nvm.sh && clawdbot daemon restart\""]' \
  --region us-west-2
```

---

## 6. Bot Permissions 是在邀請時設定的

### README 說的
> Generate invite URL with permissions

### 實際情況
容易誤解為在 Bot 頁面設定權限。

### 正確做法
1. 前往 **OAuth2** → **URL Generator**
2. Scopes 勾選 `bot`
3. Bot Permissions 勾選需要的權限
4. 複製產生的 URL
5. 用這個 URL 邀請 Bot 到 Server

```
⚠️ 如果需要更改權限，必須重新產生 URL 並重新邀請 Bot
```

**建議的最小權限：**
- Send Messages
- Read Message History
- View Channels

---

## 完整設定流程（驗證可行）

### Discord Developer Portal
1. 建立 Application
2. 建立 Bot，取得 Token
3. 啟用三個 Privileged Gateway Intents
4. OAuth2 → URL Generator 產生邀請連結
5. 邀請 Bot 到 Server

### EC2 (透過 SSM)
```bash
# 1. 啟用插件
clawdbot plugins enable discord

# 2. 添加 channel
clawdbot channels add --channel discord --token <BOT_TOKEN>

# 3. 設定 groupPolicy
clawdbot config set channels.discord.groupPolicy open

# 4. 重啟
clawdbot daemon restart

# 5. 批准用戶（當用戶發送 pairing code 後）
clawdbot pairing approve discord <CODE>
```

---

## 建議給專案維護者

以下內容建議補充到 README：

1. **明確說明 Discord 插件需要手動啟用**
2. **強調 MESSAGE CONTENT INTENT 是必要的**
3. **說明 groupPolicy 預設行為及如何修改**
4. **補充 pairing 機制的說明**
5. **提供 SSM send-command 的正確範例**

---

## 7. 第三方模型需要 AWS Marketplace 權限

### README 說的
> Before deploying, enable Bedrock models in Bedrock Console

### 實際情況
切換到 Claude Sonnet 4.5 後，發送訊息會收到錯誤：

```
Model access is denied due to IAM user or service role is not authorized 
to perform the required AWS Marketplace actions 
(aws-marketplace:ViewSubscriptions, aws-marketplace:Subscribe) 
to enable access to this model.
```

### 原因
CloudFormation 建立的 IAM Role 只有 Bedrock 權限，沒有 AWS Marketplace 權限。

**目前 IAM Role 權限**（來自 `clawdbot-bedrock.yaml`）：
```yaml
- Effect: Allow
  Action:
    - 'bedrock:InvokeModel'
    - 'bedrock:InvokeModelWithResponseStream'
    - 'bedrock:ListFoundationModels'
    - 'bedrock:GetFoundationModel'
  Resource: '*'
```

**缺少的權限**：
```json
{
  "Effect": "Allow",
  "Action": [
    "aws-marketplace:ViewSubscriptions",
    "aws-marketplace:Subscribe"
  ],
  "Resource": "*"
}
```

### 影響範圍

| Model 類型 | 需要 Marketplace 權限 |
|-----------|:--------------------:|
| Amazon Nova (所有版本) | ❌ 不需要 |
| Anthropic Claude (所有版本) | ✅ 需要 |
| DeepSeek R1 | ✅ 需要 |
| Meta Llama | ✅ 需要 |

### 解決方案

**方案 A：手動修改 IAM Role（推薦）**

1. 前往 AWS Console → IAM → Roles
2. 搜尋 `<stack-name>-ClawdbotInstanceRole-*`
3. 點擊 Role → Add permissions → Create inline policy
4. 選擇 JSON，貼上：
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "aws-marketplace:ViewSubscriptions",
        "aws-marketplace:Subscribe"
      ],
      "Resource": "*"
    }
  ]
}
```
5. 命名為 `MarketplaceAccessPolicy`
6. 等待 2 分鐘後重試

**方案 B：修改 CloudFormation Template**

在 `clawdbot-bedrock.yaml` 的 `ClawdbotInstanceRole` 中加入：

```yaml
- PolicyName: MarketplaceAccessPolicy
  PolicyDocument:
    Version: '2012-10-17'
    Statement:
      - Effect: Allow
        Action:
          - 'aws-marketplace:ViewSubscriptions'
          - 'aws-marketplace:Subscribe'
        Resource: '*'
```

然後更新 Stack。

### 背景說明

根據 AWS Bedrock 文件，2026 年起 Serverless foundation models 已自動啟用，不需要手動在 Model Access 頁面啟用。但對於第三方模型（Claude、DeepSeek、Llama），首次調用時仍需要 Marketplace 權限來完成訂閱流程。

```
⚠️ README 應該明確說明：使用非 Amazon 原生模型需要額外的 Marketplace 權限
```

---

## 建議給專案維護者

以下內容建議補充到 README：

1. **明確說明 Discord 插件需要手動啟用**
2. **強調 MESSAGE CONTENT INTENT 是必要的**
3. **說明 groupPolicy 預設行為及如何修改**
4. **補充 pairing 機制的說明**
5. **提供 SSM send-command 的正確範例**
6. **⭐ 新增：說明第三方模型需要 Marketplace 權限**

---

## 測試環境資訊

| 項目 | 值 |
|------|-----|
| Git Commit | 7727637 |
| AWS Region | us-west-2 |
| Stack Name | moltbot-bedrock |
| Instance Type | t4g.medium (Graviton) |
| Bedrock Model | global.amazon.nova-2-lite-v1:0 |
| IAM Role | moltbot-bedrock-ClawdbotInstanceRole-HuZ5NsYkprUG |
| 測試日期 | 2026-02-04 |

---

*本文件基於實際部署測試結果撰寫*
