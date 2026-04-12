# OpenClaw Enterprise on AWS — Deployment Notes

> Companion document for [OpenClaw-on-AWS-with-Bedrock](https://github.com/aws-samples/sample-OpenClaw-on-AWS-with-Bedrock).
> Covers deployment architecture, known issues, and fixes applied as of 2026-04-10.
> Audience: DevOps engineers deploying this stack on AWS.

---

## Current State (2026-04-10)

`deploy.sh` is now a **one-command deployment** that handles all 8 steps automatically:

```bash
cd enterprise
cp .env.example .env    # fill in: STACK_NAME, REGION, ADMIN_PASSWORD
bash deploy.sh          # ~15 min — infra + Docker + seed + services
```

No manual steps required after `deploy.sh` completes.

---

## Architecture: Gateway → H2 Proxy → AgentCore

```
IM Message (Feishu/Telegram/Discord)
  → EC2 Gateway (port 18789, openclaw@2026.3.24)
  → Gateway agent calls Bedrock API
  → AWS SDK redirected to H2 Proxy via AWS_ENDPOINT_URL_BEDROCK_RUNTIME
  → H2 Proxy (port 8091)
     - PATH C: pairing flow (/start TOKEN → BIND)
     - Binding check: DynamoDB MAPPING#
     - Tenant routing → Tenant Router
  → Tenant Router (port 8090)
     - Resolves employee → position → AgentCore Runtime
  → AgentCore microVM (Firecracker, serverless)
     - workspace_assembler: 3-layer SOUL from DynamoDB/S3
     - Full OpenClaw instance per employee
```

**Critical:** The Gateway → H2 Proxy routing requires `AWS_ENDPOINT_URL_BEDROCK_RUNTIME=http://localhost:8091` in the Gateway systemd service. `ec2-setup.sh` configures this automatically.

---

## Known Issues & Workarounds

### 1. ECS Service Linked Role (New Accounts)

First deployment on a new AWS account may fail with:
```
Unable to assume the service linked role
```

**Fix:** Wait 30 seconds and re-run `deploy.sh`. The ECS service linked role needs time to propagate.

### 2. S3 Bucket Name Conflict (Multi-Region)

Default bucket name is `openclaw-tenants-{ACCOUNT_ID}`. If deploying in multiple regions on the same account, set `WORKSPACE_BUCKET_NAME` in `.env`:

```
WORKSPACE_BUCKET_NAME=openclaw-mystack-us-east-1
```

### 3. boto3 Version on Ubuntu 24.04

Ubuntu 24.04 ships old botocore. `ec2-setup.sh` automatically upgrades:
```bash
pip3 install --break-system-packages --upgrade boto3 botocore
```

### 4. Gateway DM Policy for IM Channels

When configuring IM bots (Feishu, Telegram, etc.) via Gateway UI:
- **Select "Open" for DM access mode** (not "Pairing")
- H2 Proxy handles identity verification via binding check
- Gateway-level pairing is for personal use, not enterprise

### 5. Docker Image Updates

If you modify `enterprise/agent-container/` code (server.py, workspace_assembler.py, permissions.py), you must rebuild the Docker image:

```bash
bash deploy.sh --skip-seed    # rebuilds Docker + redeploys services
```

AgentCore will pick up the new image on next session creation (old sessions may take 5 min to expire).

---

## Environment Variables

All configuration flows through `/etc/openclaw/env` on EC2:

| Variable | Source | Used By |
|----------|--------|---------|
| `STACK_NAME` | .env | All services |
| `AWS_REGION` | .env | All services |
| `DYNAMODB_TABLE` | Defaults to STACK_NAME | Admin Console, Agent Container |
| `DYNAMODB_REGION` | Defaults to AWS_REGION | Admin Console, Agent Container |
| `S3_BUCKET` | CFN output | All services |
| `AGENTCORE_RUNTIME_ID` | deploy.sh Step 4 | Tenant Router |
| `BEDROCK_MODEL_ID` | .env | Gateway, Agent Container |

Agent Container receives env vars via AgentCore Runtime API (deploy.sh Step 4).

---

## Data Sources

All tenant data is in DynamoDB (single-table design):

| Data | DynamoDB Key | Previously |
|------|-------------|-----------|
| Employee → Position | `EMP#{id}.positionId` | SSM (migrated) |
| Position → Tools | `POS#{id}.toolAllowlist` | SSM (migrated) |
| User Mappings | `MAPPING#{channel}__{userId}` | SSM (migrated) |
| Bindings | `BIND#{id}` | DynamoDB (unchanged) |
| Config | `CONFIG#{key}` | DynamoDB (unchanged) |

SSM is only used for: secrets (admin-password, jwt-secret, gateway-token), runtime-id, and always-on endpoints.

---

*Last updated: 2026-04-10.*
