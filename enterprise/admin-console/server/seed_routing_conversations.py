"""Seed routing rules and session conversations into DynamoDB."""
import argparse
import os
import boto3

ORG = "ORG#acme"

def seed(table_name: str, region: str):
    ddb = boto3.resource("dynamodb", region_name=region)
    table = ddb.Table(table_name)
    items = []

    # Routing rules
    rules = [
        {"id": "rule-01", "priority": 1, "name": "Engineering Telegram", "condition": {"channel": "telegram", "department": "Engineering"}, "action": "route_to_personal_agent", "description": "Engineering employees on Telegram → their personal 1:1 agent"},
        {"id": "rule-02", "priority": 2, "name": "Help Desk Discord", "condition": {"channel": "discord", "messagePrefix": "/helpdesk"}, "action": "route_to_shared_agent", "agentId": "agent-helpdesk", "description": "Anyone on Discord with /helpdesk → IT Help Desk shared agent"},
        {"id": "rule-03", "priority": 3, "name": "Finance Slack", "condition": {"channel": "slack", "role": "finance"}, "action": "route_to_personal_agent", "description": "Finance employees on Slack → their personal Finance agent"},
        {"id": "rule-04", "priority": 4, "name": "Sales WhatsApp", "condition": {"channel": "whatsapp", "department": "Sales"}, "action": "route_to_personal_agent", "description": "Sales employees on WhatsApp → their personal Sales agent"},
        {"id": "rule-05", "priority": 5, "name": "New Hire Onboarding", "condition": {"role": "intern"}, "action": "route_to_shared_agent", "agentId": "agent-onboarding", "description": "All interns → Onboarding Assistant shared agent"},
        {"id": "rule-06", "priority": 10, "name": "Default", "condition": {}, "action": "route_to_personal_agent", "description": "Default: route to employee's personal 1:1 agent"},
    ]
    for r in rules:
        items.append({"PK": ORG, "SK": f"RULE#{r['id']}", "GSI1PK": "TYPE#rule", "GSI1SK": f"RULE#{r['id']}", **r})

    # Session conversations (keyed by session ID)
    conversations = {
        "sess-001": [  # SA Agent - Zhang San
            {"role": "user", "content": "Review this architecture diagram for the new microservice", "ts": "10:18:23"},
            {"role": "assistant", "content": "I'll analyze the architecture diagram. Let me use Jina Reader to extract the details.", "ts": "10:18:25"},
            {"role": "tool", "content": "jina-reader: Extracted 3 components, 5 connections, 2 data stores", "ts": "10:18:28", "toolName": "jina-reader", "toolStatus": "success", "toolDuration": "2.3s"},
            {"role": "assistant", "content": "Based on the diagram:\n\n**Strengths:**\n- Good separation with API Gateway → Lambda → DynamoDB\n- Event-driven pattern with SQS\n\n**Concerns:**\n1. No failover on API Gateway\n2. Missing WAF\n3. Consider DynamoDB reserved capacity\n\nWant a cost estimate?", "ts": "10:18:35"},
            {"role": "user", "content": "Yes, estimate for 1000 req/s", "ts": "10:19:12"},
            {"role": "tool", "content": "cost-calculator: $847/mo (API GW $350, Lambda $210, DDB $180, SQS $45, Transfer $62)", "ts": "10:19:15", "toolName": "cost-calculator", "toolStatus": "success", "toolDuration": "1.8s"},
            {"role": "assistant", "content": "Cost breakdown for 1000 req/s:\n\n| Service | Monthly |\n|---------|--------|\n| API Gateway | $350 |\n| Lambda | $210 |\n| DynamoDB | $180 |\n| SQS | $45 |\n| Transfer | $62 |\n| **Total** | **$847** |\n\nOptimized: ~$506/mo (40% savings) with reserved capacity + Graviton + HTTP API.", "ts": "10:19:22"},
        ],
        "sess-002": [  # SDE Agent - Wang Wu
            {"role": "user", "content": "Help me debug this race condition in the connection pool", "ts": "10:05:10"},
            {"role": "assistant", "content": "Let me look at the connection pool code. Can you share the file path?", "ts": "10:05:12"},
            {"role": "user", "content": "src/db/pool.py — connections leak under high concurrency", "ts": "10:05:30"},
            {"role": "tool", "content": "file_read: src/db/pool.py (142 lines)", "ts": "10:05:32", "toolName": "file", "toolStatus": "success", "toolDuration": "0.5s"},
            {"role": "assistant", "content": "Found the issue on line 87. The acquire() method doesn't use a lock:\n\n```python\n# Bug: race condition\nif len(self._pool) < self._max_size:\n    conn = await self._create()\n```\n\nFix: wrap in `async with self._lock:` and add `finally` in `release()`.", "ts": "10:05:45"},
            {"role": "user", "content": "Good catch. Write a test for this?", "ts": "10:06:20"},
            {"role": "tool", "content": "code_execution: pytest test_pool_concurrency.py — 5 passed", "ts": "10:06:35", "toolName": "code_execution", "toolStatus": "success", "toolDuration": "3.2s"},
            {"role": "assistant", "content": "Created tests/test_pool_concurrency.py with 5 tests covering concurrent acquire, pool exhaustion, release on error, leak detection, and timeout. All passing.", "ts": "10:06:42"},
            {"role": "tool", "content": "github-pr: Created PR #247 'Fix connection pool race condition'", "ts": "10:07:08", "toolName": "github-pr", "toolStatus": "success", "toolDuration": "2.1s"},
        ],
        "sess-003": [  # DevOps Agent - Sun Hao
            {"role": "user", "content": "Check the Terraform plan for the new VPC peering setup", "ts": "09:50:05"},
            {"role": "tool", "content": "shell: terraform plan -out=vpc-peering.tfplan (12 to add, 0 to change)", "ts": "09:50:18", "toolName": "shell", "toolStatus": "success", "toolDuration": "12.5s"},
            {"role": "assistant", "content": "Plan: 12 resources to add (2 peering connections, 4 routes, 4 SG rules, 2 accepters).\n\n**Issue:** CIDR overlap — prod (10.0.0.0/16) and dev (10.0.0.0/16) will fail. Change dev to 10.1.0.0/16.", "ts": "09:50:25"},
            {"role": "user", "content": "Update dev to 10.1.0.0/16 and re-plan", "ts": "09:51:00"},
            {"role": "tool", "content": "shell: terraform plan — 14 to add, 2 to change, 0 to destroy", "ts": "09:51:20", "toolName": "shell", "toolStatus": "success", "toolDuration": "15.2s"},
            {"role": "assistant", "content": "Updated. New plan: 14 add, 2 change (dev VPC CIDR + route table). No conflicts. Ready to apply?", "ts": "09:51:25"},
        ],
        "sess-004": [  # PM Agent - Lin Xiaoyu
            {"role": "user", "content": "Help me synthesize last weeks user interview findings", "ts": "10:25:00"},
            {"role": "tool", "content": "deep-research: Analyzed 5 interview transcripts from S3", "ts": "10:25:08", "toolName": "deep-research", "toolStatus": "success", "toolDuration": "6.2s"},
            {"role": "assistant", "content": "Key themes from 5 interviews:\n\n1. **Onboarding friction** (4/5 mentioned) — new users struggle with first 10 minutes\n2. **Search quality** (3/5) — results not relevant for technical queries\n3. **Mobile experience** (3/5) — dashboard unusable on phone\n4. **Positive: speed** (5/5) — all praised response time\n\nRecommend prioritizing onboarding wizard for next sprint.", "ts": "10:25:18"},
        ],
        "sess-005": [  # IT Help Desk Agent - Carol (shared agent)
            {"role": "user", "content": "My VPN keeps disconnecting every 30 minutes", "ts": "10:20:00"},
            {"role": "assistant", "content": "That sounds like a session timeout issue. Let me check a few things:\n\n1. Which VPN client are you using? (GlobalProtect / Cisco AnyConnect / OpenVPN)\n2. Are you on Wi-Fi or wired?\n3. Did this start recently or has it always been like this?", "ts": "10:20:03"},
            {"role": "user", "content": "GlobalProtect, Wi-Fi, started this week after the office network upgrade", "ts": "10:20:30"},
            {"role": "assistant", "content": "That's likely related to the network upgrade. The new Palo Alto firewall has a default idle timeout of 30 minutes for GP connections.\n\n**Quick fix:** Go to GlobalProtect Settings → Connection → Enable \"Keep Alive\" and set interval to 15 minutes.\n\n**Permanent fix:** I'll submit a ticket to IT Infrastructure to increase the idle timeout to 2 hours on the firewall side.\n\nWant me to create that ticket?", "ts": "10:20:38"},
            {"role": "user", "content": "Yes please, create the ticket", "ts": "10:21:00"},
            {"role": "assistant", "content": "I've noted the ticket request. However, I don't have access to the ticketing system (email-send tool is not in my permissions for Help Desk role). Please ask your IT admin to create the ticket, or I can draft the content for you to submit.\n\nIn the meantime, the Keep Alive setting should resolve the disconnections immediately.", "ts": "10:21:05"},
        ],
        "sess-006": [  # Finance Agent - Carol
            {"role": "user", "content": "Generate the Q2 budget variance report for Engineering", "ts": "10:10:00"},
            {"role": "tool", "content": "excel-gen: Generated Q2_Engineering_Variance.xlsx (12 sheets)", "ts": "10:10:15", "toolName": "excel-gen", "toolStatus": "success", "toolDuration": "4.8s"},
            {"role": "assistant", "content": "Q2 Engineering Budget Variance:\n\n| Category | Budget | Actual | Variance |\n|----------|--------|--------|----------|\n| Compute | $45K | $52K | +15.6% |\n| Storage | $12K | $10K | -16.7% |\n| Network | $8K | $7.5K | -6.3% |\n| Licenses | $20K | $22K | +10.0% |\n| **Total** | **$85K** | **$91.5K** | **+7.6%** |\n\nCompute overspend driven by GPU instances for ML training.", "ts": "10:10:22"},
            {"role": "user", "content": "Break down the compute overspend by team", "ts": "10:11:00"},
            {"role": "assistant", "content": "Compute by team:\n- Platform: $18K (on budget)\n- Backend: $15K (+$3K — new staging env)\n- ML/AI: $12K (+$5K — training jobs)\n- Frontend: $7K (on budget)\n\nML team is the main driver. They ran 3 unscheduled training jobs last month.", "ts": "10:11:10"},
        ],
        "sess-007": [  # Sales Agent - Mike Johnson
            {"role": "user", "content": "Prepare a competitive analysis for the Acme Corp deal", "ts": "10:30:00"},
            {"role": "assistant", "content": "I'll research Acme Corp and their current vendor landscape. Let me search for recent information.", "ts": "10:30:03"},
            {"role": "tool", "content": "web_search: Found 8 results for 'Acme Corp enterprise software vendor 2026'", "ts": "10:30:08", "toolName": "web_search", "toolStatus": "success", "toolDuration": "2.1s"},
            {"role": "assistant", "content": "**Acme Corp Competitive Analysis**\n\nCurrent stack:\n- CRM: Salesforce Enterprise ($150K/yr)\n- ERP: SAP S/4HANA\n- Cloud: Multi-cloud (AWS 60%, Azure 30%, GCP 10%)\n\nKey competitors in this deal:\n1. **Datadog** — monitoring, $80K proposal\n2. **Splunk** — incumbent for logging, $120K renewal\n3. **Us** — unified observability, $95K proposal\n\n**Our advantages:**\n- 40% cost savings vs Splunk renewal\n- Native AWS integration (they're 60% AWS)\n- ML-powered anomaly detection\n\n**Risk:** Splunk has a 3-year relationship with their VP of Eng.\n\nWant me to draft the proposal deck?", "ts": "10:30:22"},
        ],
        "sess-008": [  # CSM Agent - Emma Chen
            {"role": "user", "content": "Prepare QBR deck for TechCorp - pull health metrics", "ts": "10:22:00"},
            {"role": "tool", "content": "crm-query: TechCorp account data retrieved (ARR $240K, NPS 72, 3 open tickets)", "ts": "10:22:06", "toolName": "crm-query", "toolStatus": "success", "toolDuration": "1.8s"},
            {"role": "assistant", "content": "**TechCorp QBR Summary**\n\n📊 Account Health:\n- ARR: $240K (up 15% YoY)\n- NPS: 72 (industry avg: 45)\n- Usage: 89% of licensed seats active\n- Support: 3 open tickets (1 P2, 2 P3)\n\n📈 Key Wins This Quarter:\n- Migrated 200 users to new platform\n- Reduced avg response time by 35%\n- Launched 2 custom integrations\n\n⚠️ Risks:\n- P2 ticket open for 12 days (SLA breach risk)\n- Champion (VP Product) leaving in Q3\n- Renewal in 90 days — need expansion discussion\n\nShall I generate the slide deck?", "ts": "10:22:15"},
            {"role": "user", "content": "Yes, and include the usage trend chart", "ts": "10:23:00"},
            {"role": "assistant", "content": "I'll prepare the deck with usage trends. Note: I can generate the data summary but the actual PowerPoint generation requires the excel-gen skill which isn't in my CSM toolkit. I can:\n\n1. Export the data as a formatted table you can paste into slides\n2. Create a markdown report with all charts described\n3. Request excel-gen access from IT (needs approval)\n\nWhich would you prefer?", "ts": "10:23:08"},
        ],
    }

    for session_id, msgs in conversations.items():
        for i, msg in enumerate(msgs):
            item = {"PK": ORG, "SK": f"CONV#{session_id}#{i:04d}", "sessionId": session_id, "seq": i, **msg}
            items.append(item)

    print(f"Writing {len(items)} items...")
    with table.batch_writer() as batch:
        for item in items:
            batch.put_item(Item=item)
    print(f"Done! {len(rules)} routing rules + {sum(len(v) for v in conversations.values())} conversation messages seeded.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--table", default=os.environ.get("DYNAMODB_TABLE", "openclaw"))
    parser.add_argument("--region", default=os.environ.get("AWS_REGION", "us-east-1"))
    args = parser.parse_args()
    seed(args.table, args.region)
