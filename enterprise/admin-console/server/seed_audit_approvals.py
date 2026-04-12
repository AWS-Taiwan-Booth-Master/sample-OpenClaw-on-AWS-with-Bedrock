"""Seed DynamoDB with audit entries and approvals."""
import argparse
import os
import boto3

ORG = "ORG#acme"

def seed(table_name: str, region: str):
    ddb = boto3.resource("dynamodb", region_name=region)
    table = ddb.Table(table_name)
    items = []

    # Audit entries
    audits = [
        {"id": "aud-001", "timestamp": "2026-03-20T10:32:15Z", "eventType": "agent_invocation", "actorName": "Zhang San", "targetType": "agent", "detail": "Architecture review request via Telegram", "status": "success"},
        {"id": "aud-002", "timestamp": "2026-03-20T10:28:03Z", "eventType": "tool_execution", "actorName": "Wang Wu", "targetType": "agent", "detail": "shell: git status (Backend Team repo)", "status": "success"},
        {"id": "aud-003", "timestamp": "2026-03-20T10:25:00Z", "eventType": "permission_denied", "actorName": "Zhou Xiaoming", "targetType": "system", "detail": "Attempted shell access — Intern role denied", "status": "blocked"},
        {"id": "aud-004", "timestamp": "2026-03-20T10:22:00Z", "eventType": "tool_execution", "actorName": "Sun Hao", "targetType": "agent", "detail": "shell: terraform plan -out=vpc-peering.tfplan", "status": "success"},
        {"id": "aud-005", "timestamp": "2026-03-20T10:20:00Z", "eventType": "config_change", "actorName": "Zhang San", "targetType": "agent", "detail": "Updated personal SOUL layer v1 -> v2", "status": "info"},
        {"id": "aud-006", "timestamp": "2026-03-20T10:18:00Z", "eventType": "agent_invocation", "actorName": "Lin Xiaoyu", "targetType": "agent", "detail": "User interview synthesis via Feishu", "status": "success"},
        {"id": "aud-007", "timestamp": "2026-03-20T10:15:00Z", "eventType": "session_start", "actorName": "Li Si", "targetType": "agent", "detail": "New session via WhatsApp", "status": "success"},
        {"id": "aud-008", "timestamp": "2026-03-20T10:12:00Z", "eventType": "permission_denied", "actorName": "Mike Johnson", "targetType": "system", "detail": "Attempted code_execution — AE role denied", "status": "blocked"},
        {"id": "aud-009", "timestamp": "2026-03-20T10:10:00Z", "eventType": "approval_decision", "actorName": "Jenny Liu", "targetType": "skill", "detail": "SAP Connector skill access approved for Finance team", "status": "info"},
        {"id": "aud-010", "timestamp": "2026-03-20T10:08:00Z", "eventType": "tool_execution", "actorName": "Yang Fan", "targetType": "agent", "detail": "code_execution: npm run test (Frontend Team)", "status": "success"},
        {"id": "aud-011", "timestamp": "2026-03-20T10:05:00Z", "eventType": "config_change", "actorName": "Rachel Li", "targetType": "agent", "detail": "Added GDPR compliance knowledge base to Legal Agent", "status": "info"},
        {"id": "aud-012", "timestamp": "2026-03-20T10:02:00Z", "eventType": "agent_invocation", "actorName": "Carol Zhang", "targetType": "agent", "detail": "Q2 budget variance report via Slack", "status": "success"},
        {"id": "aud-013", "timestamp": "2026-03-20T10:00:00Z", "eventType": "session_start", "actorName": "Emma Chen", "targetType": "agent", "detail": "QBR preparation session via Slack", "status": "success"},
        {"id": "aud-014", "timestamp": "2026-03-20T09:55:00Z", "eventType": "tool_execution", "actorName": "Huang Li", "targetType": "agent", "detail": "jira-query: Sprint 12 open bugs (QA Team)", "status": "success"},
        {"id": "aud-015", "timestamp": "2026-03-20T09:50:00Z", "eventType": "permission_denied", "actorName": "Ma Tianyu", "targetType": "system", "detail": "Attempted file_write — Intern role denied", "status": "blocked"},
        {"id": "aud-016", "timestamp": "2026-03-20T09:45:00Z", "eventType": "agent_invocation", "actorName": "Sarah Kim", "targetType": "agent", "detail": "APAC deal pipeline review via WhatsApp", "status": "success"},
        {"id": "aud-017", "timestamp": "2026-03-20T09:40:00Z", "eventType": "session_end", "actorName": "David Park", "targetType": "agent", "detail": "Budget forecast session ended (12 turns, 18min)", "status": "success"},
        {"id": "aud-018", "timestamp": "2026-03-20T09:35:00Z", "eventType": "approval_decision", "actorName": "Sun Hao", "targetType": "binding", "detail": "Approved onboarding agent access for intern Zhou Xiaoming", "status": "info"},
        {"id": "aud-019", "timestamp": "2026-03-20T09:30:00Z", "eventType": "tool_execution", "actorName": "Wu Hao", "targetType": "agent", "detail": "shell: kubectl get pods -n production", "status": "success"},
        {"id": "aud-020", "timestamp": "2026-03-20T09:25:00Z", "eventType": "config_change", "actorName": "IT Admin", "targetType": "system", "detail": "Updated global TOOLS.md — added new blocked patterns", "status": "info"},
    ]
    for a in audits:
        items.append({"PK": ORG, "SK": f"AUDIT#{a['id']}", "GSI1PK": "TYPE#audit", "GSI1SK": f"AUDIT#{a['id']}", **a})

    # Approvals
    approvals = [
        {"id": "APR-001", "tenant": "Zhou Xiaoming", "tenantId": "intern_zhou", "tool": "shell", "reason": "Need shell access to run unit tests for onboarding project", "risk": "high", "timestamp": "2026-03-20T09:23:00Z", "status": "pending"},
        {"id": "APR-002", "tenant": "Carol Zhang", "tenantId": "sl__finance_carol", "tool": "data_path:/finance/reports/q2", "reason": "Quarterly report generation requires access to Q2 financial data", "risk": "medium", "timestamp": "2026-03-20T10:05:00Z", "status": "pending"},
        {"id": "APR-003", "tenant": "Ma Tianyu", "tenantId": "dk__intern_mty", "tool": "file_write", "reason": "Need to export sales training materials to local drive", "risk": "medium", "timestamp": "2026-03-20T10:30:00Z", "status": "pending"},
        {"id": "APR-098", "tenant": "Alex Wang", "tenantId": "tg__engineer_alex", "tool": "code_execution", "reason": "CI pipeline debugging requires code execution in sandbox", "risk": "high", "timestamp": "2026-03-19T14:12:00Z", "status": "approved", "reviewer": "Jordan Lee", "resolvedAt": "2026-03-19T14:18:00Z"},
        {"id": "APR-097", "tenant": "Mike Johnson", "tenantId": "wa__sales_mike", "tool": "file_write", "reason": "Export CRM contacts to CSV", "risk": "medium", "timestamp": "2026-03-19T11:30:00Z", "status": "denied", "reviewer": "Jordan Lee", "resolvedAt": "2026-03-19T11:45:00Z"},
        {"id": "APR-096", "tenant": "Sarah Chen", "tenantId": "wa__intern_sarah", "tool": "browser", "reason": "Research internal wiki for documentation task", "risk": "low", "timestamp": "2026-03-18T16:00:00Z", "status": "approved", "reviewer": "Auto-approved (low risk)", "resolvedAt": "2026-03-18T16:00:00Z"},
    ]
    for a in approvals:
        items.append({"PK": ORG, "SK": f"APPROVAL#{a['id']}", "GSI1PK": "TYPE#approval", "GSI1SK": f"APPROVAL#{a['id']}", **a})

    print(f"Writing {len(items)} items...")
    with table.batch_writer() as batch:
        for item in items:
            batch.put_item(Item=item)
    print(f"Done! {len(items)} audit + approval items seeded.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--table", default=os.environ.get("DYNAMODB_TABLE", "openclaw"))
    parser.add_argument("--region", default=os.environ.get("AWS_REGION", "us-east-1"))
    args = parser.parse_args()
    seed(args.table, args.region)
