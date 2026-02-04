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
  --stack-name moltbot-bedrock \
  --region us-west-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`InstanceId`].OutputValue' \
  --output text)

# 連線
aws ssm start-session --target $INSTANCE_ID --region us-west-2

# 切換到 ubuntu 用戶
sudo su - ubuntu
```

**方法 B：透過 send-command（適合自動化）**

```bash
aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["sudo -u ubuntu bash -c \". /home/ubuntu/.nvm/nvm.sh && <YOUR_COMMAND>\""]' \
  --region us-west-2
```

### Step 2.2: 啟用 Discord 插件

```bash
# 檢查插件狀態
clawdbot plugins list

# 如果 Discord 顯示 disabled，執行：
clawdbot plugins enable discord
```

預期輸出：
```
Enabled plugin: discord
```

### Step 2.3: 添加 Discord Channel

```bash
# 添加 Discord channel（使用你在 Step 1.2 取得的 Token）
clawdbot channels add --channel discord --token <YOUR_BOT_TOKEN>
```

預期輸出：
```
Added channel: discord
```

驗證配置：
```bash
clawdbot channels list
```

預期輸出：
```
- Discord default: configured, token=config, enabled
```

### Step 2.4: 設定 Group Policy（重要！）

```bash
# 檢查當前設定
clawdbot config get channels.discord
```

預設輸出：
```json
{
  "groupPolicy": "allowlist",
  "allowlist": [],
  "denylist": []
}
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

預期輸出：
```
Restarting gateway...
Gateway restarted successfully
```

### Step 2.6: 驗證狀態

```bash
clawdbot channels status
```

預期輸出：
```
Discord:
  Status: running
  Intents: guilds, guildMessages, directMessages, messageContent
  ...
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

預期輸出：
```
Approved pairing for discord user
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

## 下一步

- 📖 [Moltbot 官方文件](https://docs.molt.bot/)
- 💬 [設定其他 Channel（WhatsApp/Telegram/Slack）](https://docs.molt.bot/channels)
- ⚙️ [自訂 System Prompt](https://docs.molt.bot/configuration)

---

*最後更新：2026-02-04*
