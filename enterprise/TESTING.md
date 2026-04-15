# Testing the Enterprise Deployment

## Prerequisites

- AWS CLI v2 with SSM Session Manager plugin installed
- Active CloudFormation stack `openclaw-enterprise` in `us-east-1`
- EC2 instance: `i-0fd7895cee7d0f9c4`

## Access Admin Console

```bash
aws ssm start-session --target i-0fd7895cee7d0f9c4 --region us-east-1 \
  --document-name AWS-StartPortForwardingSession \
  --parameters 'portNumber=8099,localPortNumber=8099'
```

Open http://localhost:8099

- Login with any seeded employee ID
- Password: `OpenClaw2026!`
- First login requires setting a personal password

## Access OpenClaw Gateway Console

```bash
aws ssm start-session --target i-0fd7895cee7d0f9c4 --region us-east-1 \
  --document-name AWS-StartPortForwardingSession \
  --parameters 'portNumber=18789,localPortNumber=18789'
```

Open http://localhost:18789 to configure IM bot channels (Telegram, Slack, Feishu, Discord).

## Key Environment Info

| Resource | Value |
|----------|-------|
| Stack Name | `openclaw-enterprise` |
| Region | `us-east-1` |
| EC2 Instance | `i-0fd7895cee7d0f9c4` |
| S3 Bucket | `openclaw-tenants-576186206185` |
| DynamoDB Table | `openclaw-enterprise` (us-east-1) |
| ECR Repo | `576186206185.dkr.ecr.us-east-1.amazonaws.com/openclaw-enterprise-multitenancy-agent` |
| AgentCore Runtime | `openclaw_enterprise_runtime-LNEdF69ybp` |
| Key Pair | `ec2-all-key` |

## SSH Access (Emergency)

```bash
ssh -i ~/.ssh/ec2-all-key.pem ubuntu@<public-ip>
```

Or via SSM:

```bash
aws ssm start-session --target i-0fd7895cee7d0f9c4 --region us-east-1
```

## Verify Services on EC2

```bash
# Check admin console
systemctl status openclaw-admin-console

# Check gateway services
systemctl status openclaw-tenant-router
systemctl status openclaw-bedrock-proxy-h2

# Check OpenClaw Gateway
systemctl --user status openclaw-gateway

# View logs
journalctl -u openclaw-admin-console -f --no-pager -n 50
```

## Deploy Updates

```bash
cd enterprise

# Full update (rebuild Docker + redeploy services)
bash deploy.sh --skip-seed

# Update services only (skip Docker rebuild)
bash deploy.sh --skip-build --skip-seed

# Update infrastructure only
bash deploy.sh --skip-build --skip-seed --skip-services
```
