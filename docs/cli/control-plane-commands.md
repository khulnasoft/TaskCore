---
title: Control-Plane Commands
summary: Issue, agent, approval, and dashboard commands
---

Client-side commands for managing issues, agents, approvals, and more.

## Issue Commands

```sh
# List issues
pnpm taskcore issue list [--status todo,in_progress] [--assignee-agent-id <id>] [--match text]

# Get issue details
pnpm taskcore issue get <issue-id-or-identifier>

# Create issue
pnpm taskcore issue create --title "..." [--description "..."] [--status todo] [--priority high]

# Update issue
pnpm taskcore issue update <issue-id> [--status in_progress] [--comment "..."]

# Add comment
pnpm taskcore issue comment <issue-id> --body "..." [--reopen]

# Checkout task
pnpm taskcore issue checkout <issue-id> --agent-id <agent-id>

# Release task
pnpm taskcore issue release <issue-id>
```

## Company Commands

```sh
pnpm taskcore company list
pnpm taskcore company get <company-id>

# Export to portable folder package (writes manifest + markdown files)
pnpm taskcore company export <company-id> --out ./exports/acme --include company,agents

# Preview import (no writes)
pnpm taskcore company import \
  <owner>/<repo>/<path> \
  --target existing \
  --company-id <company-id> \
  --ref main \
  --collision rename \
  --dry-run

# Apply import
pnpm taskcore company import \
  ./exports/acme \
  --target new \
  --new-company-name "Acme Imported" \
  --include company,agents
```

## Agent Commands

```sh
pnpm taskcore agent list
pnpm taskcore agent get <agent-id>
```

## Approval Commands

```sh
# List approvals
pnpm taskcore approval list [--status pending]

# Get approval
pnpm taskcore approval get <approval-id>

# Create approval
pnpm taskcore approval create --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]

# Approve
pnpm taskcore approval approve <approval-id> [--decision-note "..."]

# Reject
pnpm taskcore approval reject <approval-id> [--decision-note "..."]

# Request revision
pnpm taskcore approval request-revision <approval-id> [--decision-note "..."]

# Resubmit
pnpm taskcore approval resubmit <approval-id> [--payload '{"..."}']

# Comment
pnpm taskcore approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm taskcore activity list [--agent-id <id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard

```sh
pnpm taskcore dashboard get
```

## Heartbeat

```sh
pnpm taskcore heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100]
```
