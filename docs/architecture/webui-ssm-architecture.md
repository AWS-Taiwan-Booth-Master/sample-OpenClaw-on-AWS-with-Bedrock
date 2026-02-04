# Web UI 架構說明

## 為什麼是 localhost？

當你存取 `http://localhost:18789/?token=xxx` 時，你並不是直接連到 EC2 實例。這是透過 **SSM Session Manager 端口轉發** 實現的安全存取機制。

## 架構圖

```mermaid
sequenceDiagram
    participant Browser as 瀏覽器
    participant LocalPort as localhost:18789
    participant SSM as SSM Session Manager
    participant EC2 as EC2 實例<br/>(Moltbot Web UI)
    participant Bedrock as Amazon Bedrock

    Note over Browser,Bedrock: 步驟 1: 建立 SSM 端口轉發通道
    
    Browser->>LocalPort: 1. 開啟 http://localhost:18789
    LocalPort->>SSM: 2. 透過 SSM 加密通道轉發
    SSM->>EC2: 3. 連接到 EC2 內部 Port 18789
    EC2->>SSM: 4. 回傳 Web UI 頁面
    SSM->>LocalPort: 5. 透過加密通道回傳
    LocalPort->>Browser: 6. 顯示 Web UI

    Note over Browser,Bedrock: 步驟 2: 發送訊息給 AI
    
    Browser->>LocalPort: 7. 發送聊天訊息
    LocalPort->>SSM: 8. 轉發請求
    SSM->>EC2: 9. 傳送到 Moltbot
    EC2->>Bedrock: 10. 呼叫 Bedrock API (IAM 認證)
    Bedrock->>EC2: 11. AI 回應
    EC2->>SSM: 12. 回傳結果
    SSM->>LocalPort: 13. 轉發回應
    LocalPort->>Browser: 14. 顯示 AI 回應
```

## 網路架構圖

```mermaid
graph TB
    subgraph "你的電腦"
        Browser[瀏覽器<br/>localhost:18789]
        SSMPlugin[SSM Session Manager Plugin]
    end

    subgraph "AWS Cloud"
        subgraph "SSM Service"
            SSM[Systems Manager<br/>Session Manager]
        end

        subgraph "VPC 10.0.0.0/16"
            subgraph "Public Subnet 10.0.1.0/24"
                EC2[EC2 Instance<br/>Ubuntu 24.04<br/>Moltbot + Docker<br/>Port 18789]
            end
            
            subgraph "Private Subnet 10.0.2.0/24"
                VPCE_Bedrock[VPC Endpoint<br/>Bedrock Runtime]
                VPCE_SSM[VPC Endpoint<br/>SSM]
            end
            
            SG[Security Group<br/>❌ 無 Inbound 規則<br/>✅ Outbound 0.0.0.0/0]
        end
        
        Bedrock[Amazon Bedrock<br/>Nova/Claude/DeepSeek]
    end

    Browser -->|"1. http://localhost:18789"| SSMPlugin
    SSMPlugin -->|"2. 加密 WebSocket 通道"| SSM
    SSM -->|"3. 透過 VPC Endpoint"| VPCE_SSM
    VPCE_SSM -->|"4. 私有網路"| EC2
    EC2 -->|"5. IAM 認證"| VPCE_Bedrock
    VPCE_Bedrock -->|"6. 私有連線"| Bedrock
    
    style SG fill:#ff6b6b,color:#fff
    style VPCE_Bedrock fill:#4ecdc4,color:#fff
    style VPCE_SSM fill:#4ecdc4,color:#fff
```

## 端口轉發原理

```mermaid
graph LR
    subgraph "你的電腦"
        A[localhost:18789]
    end
    
    subgraph "AWS SSM"
        B[加密通道<br/>WebSocket]
    end
    
    subgraph "EC2 實例"
        C[127.0.0.1:18789<br/>Moltbot Web UI]
    end
    
    A -->|"SSM 端口轉發"| B
    B -->|"私有網路"| C
    
    style B fill:#f9ca24,color:#000
```

### 端口轉發指令解析

```bash
aws ssm start-session \
  --target <INSTANCE_ID> \                  # EC2 實例 ID
  --region <REGION> \                       # AWS 區域
  --document-name AWS-StartPortForwardingSession \  # SSM 文件
  --parameters '{"portNumber":["18789"],"localPortNumber":["18789"]}'
                 # EC2 上的 Port    # 你電腦上的 Port
```

這個指令做了什麼：
1. 在你的電腦上監聽 `localhost:18789`
2. 建立一個加密的 WebSocket 通道到 AWS SSM
3. SSM 將流量轉發到 EC2 實例的 Port 18789
4. 所有流量都經過加密，不需要開放任何公網端口

## 為什麼這樣設計？

### 安全優勢

| 傳統方式 | SSM 端口轉發 |
|---------|-------------|
| 開放 Security Group Inbound | ❌ 無需開放任何 Inbound |
| 需要公網 IP 或 Load Balancer | ❌ 不需要 |
| 可能被掃描和攻擊 | ✅ 完全隱藏 |
| 需要 SSL 憑證 | ✅ SSM 自動加密 |
| 需要防火牆規則 | ✅ IAM 權限控制 |

### 流量路徑比較

```mermaid
graph TB
    subgraph "傳統方式 ❌"
        A1[瀏覽器] -->|"公網"| B1[Load Balancer]
        B1 -->|"公網"| C1[EC2 Public IP]
        C1 --> D1[Web UI]
    end
    
    subgraph "SSM 端口轉發 ✅"
        A2[瀏覽器] -->|"localhost"| B2[SSM Plugin]
        B2 -->|"加密通道"| C2[SSM Service]
        C2 -->|"私有網路"| D2[EC2 Private]
        D2 --> E2[Web UI]
    end
    
    style B1 fill:#ff6b6b
    style C1 fill:#ff6b6b
    style B2 fill:#4ecdc4
    style C2 fill:#4ecdc4
    style D2 fill:#4ecdc4
```

## Gateway Token 的作用

```mermaid
sequenceDiagram
    participant User as 使用者
    participant WebUI as Web UI
    participant SSM as SSM Parameter Store

    Note over User,SSM: 部署時自動產生 Token
    
    WebUI->>SSM: 1. 產生隨機 Token
    SSM->>SSM: 2. 儲存為 SecureString
    
    Note over User,SSM: 存取時驗證 Token
    
    User->>WebUI: 3. 存取 localhost:18789/?token=xxx
    WebUI->>WebUI: 4. 驗證 Token
    alt Token 正確
        WebUI->>User: 5a. 允許存取
    else Token 錯誤
        WebUI->>User: 5b. 拒絕存取
    end
```

Token 儲存位置：
- SSM Parameter Store: `/clawdbot/<stack-name>/gateway-token`
- EC2 實例: `~/.clawdbot/gateway_token.txt`

## 完整存取流程

```mermaid
flowchart TD
    A[開始] --> B{SSM Plugin<br/>已安裝?}
    B -->|否| C[安裝 SSM Plugin]
    C --> D
    B -->|是| D[執行端口轉發指令]
    D --> E[SSM 建立加密通道]
    E --> F[localhost:18789 開始監聯]
    F --> G[開啟瀏覽器<br/>localhost:18789/?token=xxx]
    G --> H{Token 正確?}
    H -->|否| I[存取被拒絕]
    H -->|是| J[顯示 Web UI]
    J --> K[發送訊息]
    K --> L[Moltbot 處理]
    L --> M[呼叫 Bedrock API]
    M --> N[回傳 AI 回應]
    N --> O[顯示在 Web UI]
    
    style E fill:#4ecdc4
    style F fill:#4ecdc4
    style H fill:#f9ca24
```

## 相關文件

- [AWS 網路架構說明](./aws-network-architecture.md)
- [AWS SSM Session Manager 官方文件](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html)
- [SSM 端口轉發文件](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-sessions-start.html#sessions-start-port-forwarding)
- [Moltbot 官方文件](https://docs.molt.bot/)

## 總結

| 問題 | 答案 |
|------|------|
| 為什麼是 localhost? | SSM 端口轉發將本地端口映射到遠端 EC2 |
| 流量安全嗎? | 是，SSM 使用加密的 WebSocket 通道 |
| 需要開放防火牆嗎? | 不需要，Security Group 無 Inbound 規則 |
| Token 從哪來? | 部署時自動產生，儲存在 SSM Parameter Store |
| 為什麼不用 Load Balancer? | SSM 更安全，不暴露公網端點 |

---

*最後更新：2026-02-05*
