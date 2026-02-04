# Discord Bot 完整設定指南

本指南將帶你從零開始，完成 Moltbot Discord Bot 的設定。

## 前置條件

- ✅ 已完成 CloudFormation 部署（Stack 狀態為 CREATE_COMPLETE）
- ✅ 已安裝 AWS CLI 和 SSM Session Manager Plugin
- ✅ 有 Discord 帳號

## 總覽

```
┌─────────────────────────────────────────────────────────────────┐
│                      設定流程總覽                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Part 1: Discord 端設定                                         │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐     │
│  │ 建立    │ -> │ 啟用    │ -> │ 建立    │ -> │ 邀請    │     │
│  │ Bot     │    │ Intents │    │ Server  │    │ Bot     │     │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘     │
│                                                                 │
│  Part 2: EC2 端設定                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐     │
│  │ 啟用    │ -> │ 添加    │ -> │ 設定    │ -> │ 批准    │     │
│  │ 插件    │    │ Channel │    │ Policy  │    │ 用戶    │     │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Discord Developer Portal 設定

### Step 1.1: 建立 Discord Application

1. 前往 [Discord Developer Portal](https://discord.com/developers/applications)
2. 點擊右上角 **New Application**
3. 輸入應用程式名稱（例如：`My-Moltbot`）
4. 勾選同意條款，點擊 **Create**

### Step 1.2: 建立 Bot 並取得 Token

1. 左側選單點擊 **Bot**
2. 點擊 **Reset Token**
3. 點擊 **Yes, do it!** 確認
4. **複製並妥善保存 Token**（只會顯示一次！）

```
⚠️ 重要：Bot Token 是敏感資訊，請勿分享或提交到 Git
```

### Step 1.3: 啟用 Privileged Gateway Intents（重要！）

在 Bot 頁面往下滾動到 **Privileged Gateway Intents** 區塊：

| Intent | 說明 | 必須啟用 |
|--------|------|:--------:|
| PRESENCE INTENT | 接收用戶在線狀態 | ✅ |
| SERVER MEMBERS INTENT | 接收成員資訊 | ✅ |
| MESSAGE CONTENT INTENT | 接收訊息內容 | ✅ **必須** |

點擊 **Save Changes**

```
⚠️ 如果沒有啟用 MESSAGE CONTENT INTENT，Bot 將無法讀取訊息內容！
```


### Step 1.4: 建立 Discord Server（如果沒有）

1. 打開 Discord 應用程式（桌面版或網頁版）
2. 點擊左側欄最下方的 **+** 按鈕
3. 選擇 **Create My Own**
4. 選擇 **For me and my friends**
5. 輸入 Server 名稱，點擊 **Create**

### Step 1.5: 產生邀請連結並邀請 Bot

1. 回到 Discord Developer Portal
2. 左側選單點擊 **OAuth2** → **URL Generator**
3. **Scopes** 區塊勾選：
   - ✅ `bot`
4. **Bot Permissions** 區塊勾選：
   - ✅ Send Messages
   - ✅ Read Message History
   - ✅ View Channels
5. 複製下方產生的 **Generated URL**
6. 在瀏覽器開啟該 URL
7. 選擇你的 Server，點擊 **Authorize**

---

## Part 2: EC2 Moltbot 設定

### Step 2.1: 連線到 EC2

**方法 A：互動式 Session（推薦用於首次設定）**

```bash
# 取得 Instance ID
INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name <YOUR_STACK_NAME> \
  --region <YOUR_REGION> \
  --query 'Stacks[0].Outputs[?OutputKey==`InstanceId`].OutputValue' \
  --output text)

# 連線
aws ssm start-session --target $INSTANCE_ID --region <YOUR_REGION>

# 切換到 ubuntu 用戶
sudo su - ubuntu
```

**方法 B：透過 send-command（適合自動化）**

```bash
aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["sudo -u ubuntu bash -c \". /home/ubuntu/.nvm/nvm.sh && <YOUR_COMMAND>\""]' \
  --region <YOUR_REGION>
```

### Step 2.2: 啟用 Discord 插件

```bash
# 檢查插件狀態
clawdbot plugins list

# 如果 Discord 顯示 disabled，執行：
clawdbot plugins enable discord
```

### Step 2.3: 添加 Discord Channel

```bash
# 添加 Discord channel（使用你在 Step 1.2 取得的 Token）
clawdbot channels add --channel discord --token <YOUR_BOT_TOKEN>
```

驗證配置：
```bash
clawdbot channels list
```

### Step 2.4: 設定 Group Policy（重要！）

```bash
# 檢查當前設定
clawdbot config get channels.discord
```

```
⚠️ 預設 groupPolicy 是 allowlist，Bot 只會回應私訊，不會回應 Server 頻道！
```

**設定為 open 以回應所有 Server 頻道：**

```bash
clawdbot config set channels.discord.groupPolicy open
```

**Group Policy 選項說明：**

| 值 | 行為 | 適用場景 |
|---|------|----------|
| `allowlist` | 只回應私訊 + allowlist 中的 Server | 生產環境（預設）|
| `open` | 回應所有 Server 頻道 | POC / 個人使用 |
| `denylist` | 回應除了 denylist 以外的所有 Server | 排除特定 Server |

### Step 2.5: 重啟 Gateway

```bash
clawdbot daemon restart
```

### Step 2.6: 驗證狀態

```bash
clawdbot channels status
```

---

## Part 3: 用戶配對（Pairing）

### Step 3.1: 觸發配對請求

在 Discord 中 @ 你的 Bot 發送任意訊息：

```
@My-Moltbot Hello!
```

Bot 會回應：
```
Clawdbot: access not configured. Your Discord user id: 123456789012345678
Pairing code: ABC12XYZ
Ask the bot owner to approve with: clawdbot pairing approve discord <code>
```

### Step 3.2: 批准用戶

在 EC2 上執行：

```bash
clawdbot pairing approve discord ABC12XYZ
```

### Step 3.3: 測試

再次在 Discord 中 @ Bot：

```
@My-Moltbot 你好，請自我介紹
```

Bot 應該會回應 AI 生成的內容！🎉

---

## 快速指令參考

```bash
# === 一鍵設定（複製貼上即可）===

# 1. 啟用插件
clawdbot plugins enable discord

# 2. 添加 channel（替換 <TOKEN>）
clawdbot channels add --channel discord --token <YOUR_BOT_TOKEN>

# 3. 啟用 Server 頻道回應
clawdbot config set channels.discord.groupPolicy open

# 4. 重啟
clawdbot daemon restart

# 5. 批准用戶（替換 <CODE>）
clawdbot pairing approve discord <PAIRING_CODE>
```

---

## 常見問題

### Q: Bot 在 Discord 顯示離線？

```bash
clawdbot channels status
clawdbot daemon restart
```

### Q: Bot 私訊有回應，但 Server 頻道沒反應？

確認 groupPolicy 設定：
```bash
clawdbot config get channels.discord.groupPolicy
# 如果是 allowlist，改為 open：
clawdbot config set channels.discord.groupPolicy open
clawdbot daemon restart
```

### Q: 如何查看已批准的用戶？

```bash
clawdbot pairing list
```

### Q: 如何撤銷用戶權限？

```bash
clawdbot pairing revoke discord <USER_ID>
```

### Q: 如何查看 Discord 日誌？

```bash
clawdbot channels logs --channel discord
```

---

## 附錄：README 未提及的重要事項

### A. Web UI 無法配置 Discord

**README 說的**：
> In Web UI, add Discord channel with bot token

**實際情況**：
Web UI 顯示 "Channel config schema unavailable"，無法透過 UI 配置。必須使用 CLI。

### B. SSM send-command 執行 clawdbot 需要特殊處理

直接執行 `clawdbot` 會顯示 `command not found`，因為 clawdbot 是透過 nvm 安裝的。

**一般指令：**
```bash
aws ssm send-command \
  --instance-ids "<INSTANCE_ID>" \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["sudo -u ubuntu bash -c \". /home/ubuntu/.nvm/nvm.sh && clawdbot <COMMAND>\""]' \
  --region <REGION>
```

### C. 第三方模型需要 AWS Marketplace 權限

使用 Claude、DeepSeek、Llama 等第三方模型時，可能會收到錯誤：

```
Model access is denied due to IAM user or service role is not authorized 
to perform the required AWS Marketplace actions
```

**影響範圍**：

| Model 類型 | 需要 Marketplace 權限 |
|-----------|:--------------------:|
| Amazon Nova (所有版本) | ❌ 不需要 |
| Anthropic Claude (所有版本) | ✅ 需要 |
| DeepSeek R1 | ✅ 需要 |
| Meta Llama | ✅ 需要 |

**解決方案**：CloudFormation template 已包含 `MarketplaceAccessPolicy`。

### D. Bot Permissions 是在邀請時設定的

如果需要更改 Bot 權限，必須重新產生邀請 URL 並重新邀請 Bot 到 Server。

---

## 相關文件

- [Clawdbot 設定架構指南](../features/clawdbot-config-guide.md)
- [OpenClaw 進階功能指南](../features/openclaw-advanced-features-guide.md)
- [Moltbot 官方文件](https://docs.molt.bot/)
- [Discord Developer Portal](https://discord.com/developers/applications)

---

*最後更新：2026-02-05*
