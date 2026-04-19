# OpenClaw on AWS 架構說明

本文件詳細說明 OpenClaw (Moltbot) 在 AWS 上的網路架構、安全設計和權限管理。

## 架構總覽


```mermaid
flowchart TB
    subgraph Internet["🌐 Internet"]
        User["👤 使用者<br/>(本地電腦)"]
        Discord["💬 Discord API"]
        Telegram["📱 Telegram API"]
        WhatsApp["📞 WhatsApp API"]
    end

    subgraph AWS["☁️ AWS Cloud (us-west-2)"]
        subgraph VPC["VPC: 10.0.0.0/16"]
            subgraph PublicSubnet["Public Subnet: 10.0.1.0/24"]
                IGW["🚪 Internet Gateway"]
                EC2["🖥️ EC2 Instance<br/>t4g.medium<br/>10.0.1.111"]
            end
            
            subgraph PrivateSubnet["Private Subnet: 10.0.2.0/24"]
                VPCE_Bedrock["🔒 VPC Endpoint<br/>bedrock-runtime"]
                VPCE_SSM["🔒 VPC Endpoint<br/>ssm"]
                VPCE_SSMMsg["🔒 VPC Endpoint<br/>ssmmessages"]
                VPCE_EC2Msg["🔒 VPC Endpoint<br/>ec2messages"]
            end
        end
        
        subgraph AWSServices["AWS Services"]
            Bedrock["🤖 Amazon Bedrock<br/>(Claude/Nova)"]
            SSM["📋 Systems Manager"]
            CloudTrail["📝 CloudTrail"]
            IAM["🔐 IAM"]
        end
    end

    User -->|"SSM Session Manager<br/>Port Forward :18789"| SSM
    SSM -->|"Private DNS"| VPCE_SSM
    VPCE_SSM --> EC2
    
    EC2 -->|"Private Network"| VPCE_Bedrock
    VPCE_Bedrock --> Bedrock
    
    EC2 -->|"Outbound HTTPS"| IGW
    IGW -->|"Bot API Calls"| Discord
    IGW -->|"Bot API Calls"| Telegram
    IGW -->|"Bot API Calls"| WhatsApp
    
    EC2 -.->|"IAM Role"| IAM
    Bedrock -.->|"Audit Log"| CloudTrail
```

## 網路架構詳細說明

### VPC 配置

| 資源 | ID | CIDR/設定 |
|------|-----|----------|
| VPC | `vpc-073513ca1a769379d` | `10.0.0.0/16` |
| Public Subnet | `subnet-0d35ddfa3ee89a244` | `10.0.1.0/24` (us-west-2a) |
| Private Subnet | `subnet-0d671e6c6572f3ea5` | `10.0.2.0/24` (us-west-2a) |
| Internet Gateway | `igw-045734d3bb3ebc00e` | attached |

### EC2 Instance

| 屬性 | 值 |
|------|-----|
| Instance ID | `i-05c85500119de2149` |
| Instance Type | `t4g.medium` (Graviton ARM) |
| Private IP | `10.0.1.111` |
| Public IP | `54.188.231.102` |
| Subnet | Public Subnet (`10.0.1.0/24`) |
| Security Group | `sg-028258a8bbe63ba1a` |

---

## 網路封閉性設計

### 1. 無 Inbound 連線

```mermaid
flowchart LR
    subgraph SecurityGroup["Security Group Rules"]
        direction TB
        Inbound["❌ Inbound: 無任何規則<br/>(SSH 已停用: 127.0.0.1/32)"]
        Outbound["✅ Outbound: 0.0.0.0/0<br/>(允許所有出站)"]
    end
    
    Internet["🌐 Internet"] -->|"❌ 無法直接連入"| EC2["EC2"]
    EC2 -->|"✅ 可以連出"| Internet
```

**關鍵設計**：
- **SSH 已停用**：`AllowedSSHCIDR: 127.0.0.1/32` 表示沒有任何 IP 可以 SSH
- **無 Public Port**：Security Group 沒有任何 Inbound 規則
- **唯一存取方式**：SSM Session Manager（透過 VPC Endpoint）

### 2. VPC Endpoints (Private Link)

所有 AWS 服務通訊都透過 VPC Endpoints，不經過公網：

```mermaid
flowchart LR
    subgraph VPC["VPC 內部"]
        EC2["EC2<br/>10.0.1.111"]
        
        subgraph PrivateSubnet["Private Subnet"]
            VPCE1["vpce-bedrock-runtime<br/>✅ PrivateDNS"]
            VPCE2["vpce-ssm<br/>✅ PrivateDNS"]
            VPCE3["vpce-ssmmessages<br/>✅ PrivateDNS"]
            VPCE4["vpce-ec2messages<br/>✅ PrivateDNS"]
        end
    end
    
    subgraph AWS["AWS Services"]
        Bedrock["Bedrock"]
        SSM["SSM"]
    end
    
    EC2 -->|"Private Network<br/>不經過 Internet"| VPCE1
    EC2 -->|"Private Network"| VPCE2
    VPCE1 --> Bedrock
    VPCE2 --> SSM
```

| VPC Endpoint | Service | 用途 |
|--------------|---------|------|
| `vpce-09b45605f8de1941d` | `bedrock-runtime` | AI 模型調用 |
| `vpce-0da336d287ef78d43` | `ssm` | Systems Manager |
| `vpce-07322bff2a39d2627` | `ssmmessages` | Session Manager |
| `vpce-0f5f308c35dca2fc7` | `ec2messages` | EC2 訊息 |

### 3. VPC Endpoint Security Group

```mermaid
flowchart LR
    EC2["EC2<br/>sg-028258a8bbe63ba1a"] -->|"TCP 443"| VPCE["VPC Endpoints<br/>sg-09d3d3289d14e4bb1"]
    
    style VPCE fill:#90EE90
```

| 規則 | 來源 | Port | 說明 |
|------|------|------|------|
| Inbound | `sg-028258a8bbe63ba1a` (EC2) | 443 | 只允許 EC2 連入 |
| Outbound | `0.0.0.0/0` | All | 允許回應 |

---

## 權限管理架構

### IAM Role 結構

```mermaid
flowchart TB
    subgraph EC2Instance["EC2 Instance"]
        App["OpenClaw App"]
    end
    
    subgraph InstanceProfile["Instance Profile"]
        Role["ClawdbotInstanceRole"]
    end
    
    subgraph ManagedPolicies["AWS Managed Policies"]
        SSMCore["AmazonSSMManagedInstanceCore"]
        CWAgent["CloudWatchAgentServerPolicy"]
    end
    
    subgraph InlinePolicies["Inline Policies (最小權限)"]
        Bedrock["BedrockAccessPolicy<br/>• InvokeModel<br/>• InvokeModelWithResponseStream<br/>• ListFoundationModels<br/>• GetFoundationModel"]
        Marketplace["MarketplaceAccessPolicy<br/>• ViewSubscriptions<br/>• Subscribe<br/>⚠️ Condition: CalledViaLast=bedrock"]
        SSMParam["SSMParameterPolicy<br/>• PutParameter<br/>• GetParameter<br/>🔒 Resource: /clawdbot/*"]
    end
    
    App --> Role
    Role --> SSMCore
    Role --> CWAgent
    Role --> Bedrock
    Role --> Marketplace
    Role --> SSMParam
```

### 權限詳細說明

#### 1. BedrockAccessPolicy

```json
{
  "Effect": "Allow",
  "Action": [
    "bedrock:InvokeModel",
    "bedrock:InvokeModelWithResponseStream",
    "bedrock:ListFoundationModels",
    "bedrock:GetFoundationModel"
  ],
  "Resource": "*"
}
```

**設計原則**：只給予調用模型所需的最小權限，不包含管理權限。

#### 2. MarketplaceAccessPolicy (第三方模型)

```json
{
  "Sid": "MarketplaceFor3pModels",
  "Effect": "Allow",
  "Action": [
    "aws-marketplace:ViewSubscriptions",
    "aws-marketplace:Subscribe"
  ],
  "Resource": "*",
  "Condition": {
    "StringEquals": {
      "aws:CalledViaLast": "bedrock.amazonaws.com"
    }
  }
}
```

**設計原則**：
- 只允許透過 Bedrock API 調用時才能使用 Marketplace 權限
- 防止直接調用 Marketplace API 訂閱其他產品

#### 3. SSMParameterPolicy

```json
{
  "Effect": "Allow",
  "Action": ["ssm:PutParameter", "ssm:GetParameter"],
  "Resource": "arn:aws:ssm:us-west-2:118903272200:parameter/clawdbot/moltbot-bedrock/*"
}
```

**設計原則**：限制只能存取特定路徑的 Parameter Store。

---

## 存取流程

### 管理員存取 Web UI

```mermaid
sequenceDiagram
    participant Admin as 👤 管理員
    participant CLI as AWS CLI
    participant SSM as SSM Service
    participant VPCE as VPC Endpoint
    participant EC2 as EC2 Instance
    participant WebUI as Web UI :18789

    Admin->>CLI: aws ssm start-session<br/>--document-name AWS-StartPortForwardingSession
    CLI->>SSM: 建立 Session
    SSM->>VPCE: 透過 VPC Endpoint
    VPCE->>EC2: 建立連線
    EC2-->>Admin: Port Forward localhost:18789
    Admin->>WebUI: http://localhost:18789/?token=xxx
    WebUI-->>Admin: Web UI 介面
```

### AI 模型調用流程

```mermaid
sequenceDiagram
    participant User as 👤 使用者
    participant Discord as Discord
    participant EC2 as EC2 (OpenClaw)
    participant VPCE as VPC Endpoint
    participant Bedrock as Amazon Bedrock
    participant Claude as Claude Sonnet

    User->>Discord: @Bot 你好
    Discord->>EC2: Webhook (HTTPS)
    EC2->>VPCE: InvokeModel (Private)
    VPCE->>Bedrock: API Request
    Bedrock->>Claude: 推理請求
    Claude-->>Bedrock: 回應
    Bedrock-->>VPCE: API Response
    VPCE-->>EC2: 回應
    EC2->>Discord: 回覆訊息
    Discord-->>User: Bot 回覆
```

---

## 安全特性總結

| 特性 | 實作方式 | 效果 |
|------|---------|------|
| **無公開端口** | Security Group 無 Inbound | 無法從外部直接連入 |
| **SSH 停用** | `AllowedSSHCIDR: 127.0.0.1/32` | 只能透過 SSM 存取 |
| **私有網路** | VPC Endpoints | Bedrock/SSM 流量不經公網 |
| **最小權限** | Inline Policies + Conditions | 只給必要權限 |
| **條件限制** | `aws:CalledViaLast` | Marketplace 只能透過 Bedrock 調用 |
| **資源限制** | SSM Parameter 路徑限制 | 只能存取特定 Parameter |
| **審計日誌** | CloudTrail | 所有 API 調用都有記錄 |

---

## 實際部署資訊

| 項目 | 值 |
|------|-----|
| AWS Account | `118903272200` |
| Region | `us-west-2` |
| Stack Name | `moltbot-bedrock` |
| VPC ID | `vpc-073513ca1a769379d` |
| Instance ID | `i-05c85500119de2149` |
| IAM Role | `moltbot-bedrock-ClawdbotInstanceRole-HuZ5NsYkprUG` |

---

## 資料來源說明

### ✅ 實測驗證

本文件所有資訊來自以下 AWS CLI 查詢：

- `aws ec2 describe-vpcs`
- `aws ec2 describe-subnets`
- `aws ec2 describe-vpc-endpoints`
- `aws ec2 describe-security-groups`
- `aws ec2 describe-instances`
- `aws ec2 describe-route-tables`
- `aws iam list-role-policies`
- `aws iam get-role-policy`
- `aws iam list-attached-role-policies`

### 📖 來自 CloudFormation

- `clawdbot-bedrock.yaml` 模板定義

---

*最後更新：2026-02-04*
*基於 Stack: moltbot-bedrock 實際部署狀態*
