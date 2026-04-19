# OpenClaw 升級與故障排除紀錄（2026-04-19）

本文件記錄 2026-04-19 將 OpenClaw 從 v2026.4.5 升級到 v2026.4.15 過程中遇到的所有問題與解法，供日後參考。

## 環境

- **Account**：`118903272200`
- **Profile**：`fde-sandbox-ai-agent`
- **Region**：`us-west-2`
- **Stack**：`openclaw-bedrock`
- **Instance**：`t4g.medium`（ARM64/Graviton）

## 遇到的問題總覽

| # | 問題 | 根因 | 解法 |
|---|------|------|------|
| 1 | fork 落後上游 461 commit | 長時間沒同步 | `git fetch upstream && git merge upstream/main` |
| 2 | 本地 ENICleanup Lambda 跟上游衝突 | 上游刻意移除了 ENICleanup | 丟棄本地修改，採用上游 |
| 3 | Discord plugin 一直 `Failed to resolve Discord application id` | openclaw v2026.4.5 的 Discord plugin bug | 升級到 v2026.4.15 |
| 4 | Web UI 點 update 導致 CLI 壞掉 | UI 更新機制只拉了部分檔案 | 手動 `npm install -g openclaw@latest` |
| 5 | `openclaw approvals allowlist add` 失敗 | v2026.4.11+ 拒絕透過 symlink 寫入 exec-approvals | 用 bind mount 或 `OPENCLAW_STATE_DIR` |
| 6 | Opus 4.7 顯示 `FailoverError: Unknown model` | v2026.4.11 的 model catalog 沒收錄 Opus 4.7 | 升級到 v2026.4.15+ |
| 7 | WhatsApp plugin `Cannot find module channel.runtime-*.js` | npm 升級殘留舊檔案 | 完整 `npm uninstall` + `npm install` |
| 8 | `/model` 下拉選單顯示無法使用的模型 ID | auto-discovery cache 同時收錄 foundation model ID 和 inference profile | 過濾 cache，移除 Claude 4+ 沒前綴的 ID |

---

## 詳細經驗

### 1. Symlink vs Bind Mount（v2026.4.11+ 相容性）

#### 問題

部署時 UserData 會把 `/home/ubuntu/.openclaw` 做成 symlink 指向 `/data/openclaw`（獨立 EBS volume）。這設計是為了讓 instance 重建後資料不遺失。

但 OpenClaw v2026.4.11+ 的安全機制會拒絕透過 symlink 寫入 `exec-approvals.json`，錯誤訊息：

```
Refusing to traverse symlink in exec approvals path: /home/ubuntu/.openclaw
```

造成：
- `openclaw approvals allowlist add` 無法執行
- 所有 exec 指令被拒絕（Discord 上叫 bot 跑指令會報 symlink 錯誤）

#### 解法

**方案 A：bind mount（我們先採用的方案）**

```bash
rm /home/ubuntu/.openclaw  # 移除 symlink
mkdir -p /home/ubuntu/.openclaw
mount --bind /data/openclaw /home/ubuntu/.openclaw
echo '/data/openclaw /home/ubuntu/.openclaw none bind 0 0' >> /etc/fstab
```

OpenClaw 看到的 `~/.openclaw` 是真實目錄，不再觸發 symlink 檢查。

**方案 B：OPENCLAW_STATE_DIR（上游官方採用，我們後來也切換到這個）**

```bash
mkdir -p /home/ubuntu/.config/environment.d
echo "OPENCLAW_STATE_DIR=/data/openclaw" >> /home/ubuntu/.config/environment.d/openclaw.conf
```

讓 OpenClaw 直接使用真實路徑，symlink 保留只是給 CLI 操作方便（`ls ~/.openclaw`）。

#### 結論

上游用方案 B 更優雅。我們 merge 上游時接受了他們的方案。兩種都有效，但方案 B：
- 不改 mount 結構
- 保留 symlink 方便 CLI
- 官方維護，之後 sync 不會衝突

### 2. Discord plugin 問題（v2026.4.5 vs v2026.4.15）

#### 問題

v2026.4.5 的 Discord plugin 在 `fetchDiscordApplicationId` 時失敗：

```
[discord] [default] channel exited: Failed to resolve Discord application id
```

驗證過：
- ✅ Token 有效（`curl /api/v10/users/@me` 成功）
- ✅ Discord API 可達（`curl /api/v10/oauth2/applications/@me` 成功）
- ✅ 網路連通（VPC endpoints 只影響 AWS 服務，不影響 Discord）
- ❌ openclaw 內部 resolver 呼叫失敗

#### 解法

升級到 v2026.4.15（v2026.4.11 也不行，至少要 v2026.4.14+）。

**注意**：Web UI 的 "Update" 按鈕只會下載部分檔案，導致 `Cannot find module 'openclaw.mjs'`。永遠用 CLI 升級：

```bash
export NVM_DIR=/home/ubuntu/.nvm && source /home/ubuntu/.nvm/nvm.sh
npm install -g openclaw@latest
```

### 3. Model Cache 的 foundation model ID 問題

#### 問題

用戶在 Discord `/model` 下拉選單看到 `anthropic.claude-opus-4-7`（沒 `global.` 前綴），選了之後失敗：

```
Validation error: Invocation of model ID anthropic.claude-opus-4-7 with on-demand throughput isn't supported.
Retry your request with the ID or ARN of an inference profile that contains this model.
```

#### 根因

Bedrock 有兩種模型識別：

| 類型 | 範例 | 能否 on-demand 呼叫 |
|------|------|---------------------|
| Foundation Model ID | `anthropic.claude-opus-4-7` | ❌ Claude 4+ 不行 |
| Inference Profile ID | `global.anthropic.claude-opus-4-7`<br>`us.anthropic.claude-opus-4-7` | ✅ 可以 |

OpenClaw 的 auto-discovery 會把兩種都寫進 `~/.openclaw/agents/main/agent/models.json`，但對 Claude 4+ 來說，只有 inference profile 那個能用。

#### 解法

過濾 `models.json`，移除 `anthropic.claude-(opus|sonnet|haiku)-[4-9]` 開頭的記錄（沒前綴就代表是 foundation model ID）：

```python
import json, re
p = '/data/openclaw/agents/main/agent/models.json'
with open(p) as f:
    d = json.load(f)
ms = d['providers']['amazon-bedrock']['models']
pat = re.compile(r'^anthropic\.claude-(opus|sonnet|haiku)-[4-9]')
ms = [m for m in ms if not pat.match(m.get('id', ''))]
d['providers']['amazon-bedrock']['models'] = ms
with open(p, 'w') as f:
    json.dump(d, f, indent=2)
```

CloudFormation template 已加入這段邏輯（`Filtering model cache` 步驟），新部署不會再出這個問題。

### 4. Session 鎖定的模型

#### 問題

改了 config 裡的 `agents.defaults.model.primary` 為 Opus 4.7 後，Discord 的 bot 還是回答自己是 Opus 4.6。

#### 根因

Session 建立時會記錄當時的模型 ID。之後改 default 不會自動更新已經存在的 session。

#### 解法

在 Discord 傳 `/new` 或 `/reset` 開新 session。

或透過 `/model <new-model-id>` 手動切換當前 session 的模型。

---

## OpenClaw 更新正確方式

### ❌ 不要用

- Web UI 的 "Update" 按鈕（會拉不完整檔案）

### ✅ 正確方式

**方法 1：CLI 升級**

```bash
sudo su - ubuntu
export NVM_DIR=/home/ubuntu/.nvm
source /home/ubuntu/.nvm/nvm.sh
npm install -g openclaw@latest
openclaw gateway start  # 重啟 systemd service
```

**方法 2：完整重裝（遇到 module not found 錯誤時）**

```bash
npm uninstall -g openclaw
npm install -g openclaw@latest
```

**升級後驗證**

```bash
openclaw --version  # 確認版本
openclaw gateway status  # Runtime 應該是 running
journalctl --user -u openclaw-gateway -n 20 | grep -E "ready|model"
```

---

## 常用排查指令

### Gateway 狀態

```bash
sudo su - ubuntu -c "openclaw gateway status"
sudo su - ubuntu -c "journalctl --user -u openclaw-gateway -n 50 --no-pager"
```

### Discord 連線日誌

```bash
sudo su - ubuntu -c "journalctl --user -u openclaw-gateway --since '10 min ago' | grep -i discord"
```

### 完整錯誤日誌

```bash
sudo su - ubuntu -c "tail -100 /tmp/openclaw-1000/openclaw-$(date +%Y-%m-%d).log"
```

### 目前設定的模型

```bash
sudo su - ubuntu -c "cat /data/openclaw/openclaw.json | python3 -m json.tool | grep -A2 primary"
```

### 檢查 model cache

```bash
sudo su - ubuntu -c "cat /data/openclaw/agents/main/agent/models.json | python3 -c \"import json,sys; ms=json.load(sys.stdin)['providers']['amazon-bedrock']['models']; [print(m['id']) for m in ms]\""
```

---

## 部署架構注意事項

### 資料持久化

- **Root volume**：EC2 instance 本身，重建會消失
- **Data volume (`/data/`)**：獨立 EBS volume（30GB gp3），重建時保留
- **OpenClaw 所有狀態**：儲存在 `/data/openclaw/`
- **Config 位置**：`/data/openclaw/openclaw.json`（透過 `$HOME/.openclaw` symlink 或 `OPENCLAW_STATE_DIR` 存取）

### 重建 vs 更新

- **Stack update 不改 EC2**：只改 template 變數不會重建 instance
- **Stack update 改 InstanceType 會重建**：但 data volume 會保留
- **手動 `npm install -g openclaw`**：升級 openclaw 但不影響 config 和 state

### 模型支援

本專案的 CloudFormation template `OpenClawModel` AllowedValues 需要跟 OpenClaw catalog 同步。若 Bedrock 出了新模型（如 Opus 4.8），需要：

1. 確認 Bedrock 有該 inference profile（`aws bedrock list-inference-profiles`）
2. 升級 OpenClaw 到支援該模型的版本
3. 更新 CloudFormation template 的 `OpenClawModel` AllowedValues

---

## 相關 Commit

- `5c48884` - fix: replace symlink with bind mount（我們的初版方案）
- `b81adfd` - Merge upstream/main（採用上游的 OPENCLAW_STATE_DIR 方案）
- 上游 `01e8caa` - fix: use OPENCLAW_STATE_DIR instead of symlink
- 上游 `b405b88` - fix: remove ENICleanupResource
