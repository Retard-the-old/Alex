# Alex — Project Intelligence Engine

> This replaces the Mindomo Agent entirely. Alex maintains an internal project graph
> that is the single source of truth for all business projects, team activity, workstreams,
> and deliverables. No external mind map tool is needed.

---

## Why This Exists

Alex doesn't mirror a mind map — Alex IS the map. All project intelligence lives inside Alex's database, fed continuously by WhatsApp monitoring, direct commands from Max, task outcomes, email context, calendar events, and the learning engine. There is no external tool to sync with, no API to maintain, and no risk of the map falling out of date.

When Max wants a visual overview, Alex generates one on demand from its live data.

---

## Project Graph Structure

Alex maintains a hierarchical project graph in PostgreSQL. This is the internal model — it grows and evolves as Alex learns.

```sql
CREATE TABLE project_nodes (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER REFERENCES project_nodes(id),
  project VARCHAR(100) NOT NULL,        -- 'chickerell', 'jobpeak', 'tutorii', etc.
  path TEXT NOT NULL,                    -- 'Jobpeak > Marketing > Bombay Media'
  title VARCHAR(200) NOT NULL,
  node_type VARCHAR(50),                -- 'project', 'department', 'workstream', 'task', 'milestone'
  status VARCHAR(50) DEFAULT 'active',  -- 'active', 'paused', 'completed', 'blocked', 'stalled', 'archived'
  priority VARCHAR(20) DEFAULT 'normal', -- 'critical', 'high', 'normal', 'low'
  assigned_to VARCHAR(100)[],           -- array of people names
  description TEXT,
  current_focus TEXT,                    -- what's actively being worked on in this area
  last_activity TIMESTAMP,
  last_activity_source VARCHAR(50),     -- 'whatsapp_monitoring', 'max_direct', 'task_outcome', 'email'
  stale_threshold_days INTEGER DEFAULT 14,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE project_updates (
  id SERIAL PRIMARY KEY,
  node_id INTEGER REFERENCES project_nodes(id),
  update_type VARCHAR(50),              -- 'progress', 'blocker', 'decision', 'deliverable', 'deadline', 'note', 'status_change'
  content TEXT NOT NULL,
  source VARCHAR(50),                   -- 'max_direct', 'whatsapp_monitoring', 'email', 'task_outcome', 'alex_inference'
  source_person VARCHAR(100),           -- who provided this update
  confidence VARCHAR(20),               -- 'confirmed', 'high', 'medium', 'context'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE project_deliverables (
  id SERIAL PRIMARY KEY,
  node_id INTEGER REFERENCES project_nodes(id),
  title VARCHAR(200) NOT NULL,
  assigned_to VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'review', 'completed', 'overdue'
  due_date DATE,
  completed_date DATE,
  description TEXT,
  source VARCHAR(50),                   -- how Alex learned about this deliverable
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Initial Structure (Seeded at Deployment)

```
Chickerell
├── Accounting (assigned: Adel)
├── Legal (assigned: Susan, Jane)
└── Planning (assigned: Corylus)

Jobpeak.net
├── Marketing
│   ├── Bombay Media (assigned: Farhan)
│   ├── Marketing AI Agent
│   ├── Paid Ads & Funnel Building
│   │   ├── Google Ads
│   │   └── Meta Ads
│   ├── SEO/GEO Optimisation
│   ├── Email/WA/Outreach Marketing
│   │   ├── Lead Gen Databases (assigned: Joz)
│   │   ├── Email Bot (assigned: Diyan)
│   │   └── WhatsApp Bot (assigned: Usman)
│   └── Social Media (assigned: Arnav)
└── Platform Development
    └── CRO Optimisation (assigned: Min Bui)

Tutorii.com
├── Marketing
│   ├── Email/WA/Outreach Marketing
│   │   ├── Lead Gen Databases (assigned: Joz)
│   │   ├── WhatsApp Bot (assigned: Usman)
│   │   └── Email Bot (assigned: Diyan)
│   └── Social Media
└── Platform Development
    ├── Epixel (assigned: Epixel)
    └── UX Optimisation (assigned: Min Bui)

Premierblueprint.com
├── Marketing
│   ├── Email/WA/Outreach Marketing
│   ├── Social Media
│   └── Press Releases (PR Newswire)
└── Platform Development
    └── Lead Developer (assigned: Teddy Gatu)

US Real Estate Agent Platform [PAUSED]
├── Marketing
│   └── Email Outreach
│       ├── Lead Gen Databases (assigned: Joz)
│       ├── Email Bot (assigned: Diyan)
│       └── WhatsApp Bot (assigned: Usman)
└── Platform Development
    └── Lead Developer (assigned: Teddy Gatu)

The Nail DXB
├── Leases
│   ├── Shop Lease (Djipar Landlord)
│   └── Employee Accommodation (SBK Landlord)
├── Staff
├── Administrative
│   ├── Hiring & Visas (assigned: Kathika PRO)
│   ├── Accounting (assigned: Kathika PRO)
│   ├── Banking (Wio / ENBD)
│   └── Payment Processor
└── Marketing
    ├── Instagram
    └── Automated Receptionist Agent (assigned: Usman)
```

This structure grows organically. When Alex detects new workstreams from WhatsApp monitoring or Max's commands, it either maps them to existing nodes or proposes new ones.

---

## How the Project Graph Gets Updated

### Source 1: Max's Direct Commands

Max tells Alex things about his projects constantly. Alex absorbs all of it.

| Max Says | Alex Does |
|----------|-----------|
| "We're pausing paid ads on Jobpeak" | Updates Jobpeak > Paid Ads status to 'paused', logs the decision |
| "Add an SEO audit workstream under Jobpeak Marketing" | Creates new node: Jobpeak > Marketing > SEO Audit |
| "Farhan's done with the Q1 creatives" | Updates Bombay Media current_focus, logs deliverable as completed |
| "Move Min Bui off Tutorii UX, he's focusing on Jobpeak CRO now" | Updates assignments on both nodes |
| "Chickerell planning is blocked — waiting on the council" | Updates Planning status to 'blocked', logs blocker |
| "Archive the US Agent Lead Platform — we're not pursuing it" | Moves to archived status |

No confirmation needed for these — Max's direct instructions are the highest authority.

### Source 2: WhatsApp Monitoring (Passive)

The read-only WhatsApp listener monitors Max's WhatsApp Business app conversations and extracts project intelligence from team conversations. Alex never sends messages through Max's WhatsApp — it only reads.

**Monitored contacts and their mappings:**

| Person | Projects | Watch For |
|--------|----------|-----------|
| Farhan | Bombay Media / Jobpeak | Creative deliverables, timelines, revisions |
| Usman | WhatsApp Bots (Jobpeak + Tutorii + The Nail DXB) | Bot development, feature updates, bugs, receptionist agent |
| Diyan | Email Bots (Jobpeak + Tutorii) | Email automation, campaign setups |
| Arnav | Social Media (Jobpeak) | Content schedules, posting updates, engagement |
| Min Bui | CRO/UX (Jobpeak + Tutorii) | Optimisation work, A/B tests, design |
| Joz | Lead Gen Databases (Jobpeak + Tutorii + US Agent Platform) | Database builds, lead sourcing, data quality |
| Teddy Gatu | Platform Dev (Premierblueprint + US Agent Platform) | Development progress, launches, bugs |
| Adel | Accounting (Chickerell) | Financial updates, invoicing, bookkeeping |
| Susan / Jane | Legal (Chickerell) | Contract updates, compliance, legal matters |
| Corylus | Planning (Chickerell) | Planning applications, approvals, timelines |
| Epixel | Platform Dev (Tutorii) | Development progress, bugs, launches |
| Kathika PRO | Admin (The Nail DXB) | Hiring, visas, accounting, PRO services |

**For every relevant message, extract:**

```json
{
  "sender": "Farhan",
  "project": "Jobpeak",
  "node_path": "Jobpeak > Marketing > Bombay Media",
  "update_type": "deliverable",
  "summary": "Q1 campaign creatives are done and ready for review",
  "dates_mentioned": ["2026-03-10"],
  "sentiment": "positive",
  "urgency": "normal",
  "action_for_max": "Review needed",
  "confidence": "high"
}
```

**Relevance filtering — ignore:**
- Personal/social conversation
- Logistics unrelated to projects
- Messages from non-monitored contacts
- Group chat noise that doesn't reference projects or deliverables

**How updates flow in:**

| Update Type | Auto-Apply? | Example |
|-------------|-------------|---------|
| Progress note | Yes — log silently, include in briefing | "Farhan: sent the revised banners" |
| Deliverable completed | Yes — mark complete, flag in briefing | "Usman: bot v2 is live" |
| New deadline mentioned | Yes — log, set reminder | "Corylus: council decision expected by March 20" |
| Blocker reported | Yes — flag node as blocked, alert in briefing | "Min Bui: waiting on content from Arnav to finish the landing page" |
| New work not in graph | Ask Max | "Farhan mentioned a 'Google Ads audit' — should I add this under Jobpeak Marketing?" |
| Ambiguous or uncertain | Log as context note, don't update status | "Adel mentioned something about VAT but wasn't clear" |

### Source 3: Task Outcomes

When Alex completes a task that relates to a project, the outcome feeds back into the graph.

- Alex gets a quote for kitchen work → if it relates to Chickerell, log under Chickerell
- Alex books a consultation with a contractor → log as a deliverable with a date
- Alex chases Farhan and he replies → update Bombay Media last_activity

### Source 4: Email Intelligence

Emails forwarded to Alex or passing through Alex's inbox often contain project-relevant context.

- Susan sends a contract update → log under Chickerell > Legal
- Epixel sends a dev progress report → log under Tutorii > Platform Dev
- A supplier sends an invoice → log under the relevant project

### Source 5: Calendar Events

Calendar events often signal project activity.

- "Call with Corylus re: planning" → update Chickerell > Planning last_activity
- "Jobpeak marketing review" → note that Max is actively reviewing Jobpeak marketing

---

## Queries Max Can Ask

Alex answers all project queries from its internal graph — no external tool needed.

### Status Queries

| Max Says | Alex Returns |
|----------|-------------|
| "What's the latest on Jobpeak?" | Full Jobpeak section: per-workstream status, per-person activity, recent updates, blockers, overdue items |
| "Where are we on Chickerell?" | Chickerell breakdown: Accounting, Legal, Planning — each with current status and last update |
| "What's Farhan working on?" | All nodes assigned to Farhan, with current status and last activity per node |
| "What's overdue?" | All deliverables past due date, all nodes flagged as stalled |
| "Who's been quiet?" | People with no WhatsApp activity or task updates beyond their normal pattern |
| "Is anyone stuck?" | Nodes with status 'blocked' or 'stalled', people with overdue deliverables |
| "What changed this week?" | Chronological list of all project updates from all sources in the past 7 days |
| "What do I owe people?" | Decisions/approvals/inputs Max has been asked for that are still pending |

### Mutation Commands

| Max Says | Alex Does |
|----------|-----------|
| "Add a new workstream under Tutorii for partnerships" | Creates node: Tutorii > Partnerships |
| "Mark Chickerell planning as blocked" | Updates status, asks for blocker reason if not obvious |
| "Farhan is now also working on Tutorii social media" | Adds Farhan to Tutorii > Social Media assignments |
| "Remove the AI Agent branch from Jobpeak" | Archives the node (never hard-deletes) |
| "The SEO audit is done — archive it" | Marks as completed, moves to archived |
| "Usman's deadline for the bot is March 15" | Creates deliverable with due date, sets reminder |

### Comparison & Analysis

| Max Says | Alex Returns |
|----------|-------------|
| "Which project has the most activity?" | Ranked list by update frequency in the past 7/30 days |
| "Who's delivering and who isn't?" | Per-person delivery rate: completed vs overdue deliverables |
| "Show me everything that's stalled" | All nodes/deliverables with no activity beyond their stale threshold |
| "What did Farhan deliver this month?" | List of completed deliverables attributed to Farhan |
| "How's Jobpeak compared to last month?" | Activity trend: updates, deliverables, blockers — this month vs last |

---

## Visual Output (On-Demand)

When Max wants to see the big picture visually:

### "Show me the project map"

Alex generates a structured visual representation of the current project graph. Options:

1. **Formatted WhatsApp message** — indented tree with status indicators:
```
📊 Your Business Map

🟢 Chickerell
   🟢 Accounting (Adel) — up to date
   🟡 Legal (Susan/Jane) — contract review pending
   🔴 Planning (Corylus) — BLOCKED: waiting on council

🟢 Jobpeak.net
   Marketing:
   🟢 Bombay Media (Farhan) — Q1 creatives delivered
   ⚪ AI Agent — no activity
   ⏸ Paid Ads — paused
   🟡 SEO/GEO — audit in progress
   🟢 Email/WA (Diyan) — campaigns running
   🟢 Social Media (Arnav) — posting on schedule
   🟢 Platform Dev/CRO (Min Bui) — A/B test running

🟡 Tutorii.com
   🟢 Platform Dev (Epixel) — sprint in progress
   🟢 UX (Min Bui) — optimisation work ongoing
   🟡 Email/WA (Diyan) — setup pending
   ⚪ Social Media — no activity

⚪ Premierblueprint.com
   ⚪ No recent activity across any workstream

📦 Archived
   US Agent Lead Platform
```

Status key: 🟢 Active/on track | 🟡 Needs attention | 🔴 Blocked/overdue | ⏸ Paused | ⚪ No activity

2. **Generated image/PDF** — for a more visual representation, Alex can generate a formatted diagram or document and send it via WhatsApp. The developer can implement this as a simple tree diagram renderer.

3. **Detailed export** — "Export the full project status" → Alex generates a structured document (PDF or DOCX) with full per-node detail, suitable for review or sharing.

---

## Stale Detection & Proactive Alerts

Alex doesn't wait for Max to ask — it proactively flags issues.

### Stale Thresholds (Configurable Per Node)

| Node Type | Default Stale Threshold | Alert |
|-----------|------------------------|-------|
| Active workstream | 14 days no update | "No updates from [person] on [workstream] in [X] days" |
| Deliverable in progress | 7 days past due date | "Overdue: [deliverable] was due [date], assigned to [person]" |
| Blocked node | 7 days still blocked | "Still blocked: [node] has been blocked for [X] days" |
| Critical priority node | 3 days no update | Early warning for critical items |

### What Triggers an Alert

- A node crosses its stale threshold → included in the next briefing under OVERDUE / AT RISK
- A deliverable passes its due date → included in briefing, marked as overdue
- A person's communication frequency drops significantly below their normal pattern → "Farhan usually messages every 1-2 days but hasn't been heard from in 5 days"
- A blocker hasn't been resolved within 7 days → escalated reminder

### What Doesn't Trigger an Alert

- Nodes with status 'paused' or 'archived' — intentionally inactive
- Nodes with no assigned person and no due date — background items
- Normal communication gaps during weekends or known holidays

---

## Replacing Mindomo — What's Gained and Lost

### Gained
- Single source of truth — no sync issues between Alex and an external tool
- Richer intelligence — Alex doesn't just store status, it understands context, patterns, and relationships
- Automatic updates from all data sources — not just manual edits
- Faster queries — Max asks Alex, gets an instant answer. No opening a separate app.
- Stale detection and proactive alerts built in
- Per-person delivery tracking and workload visibility
- 4 weeks saved from the build timeline (Phases 1 & 2 eliminated)
- One fewer API dependency, one fewer auth token, one fewer thing to break

### Lost
- Interactive visual mind map — drag-and-drop spatial view of the business landscape
- Manual editing by Max directly in a visual UI (Max can still edit via Alex commands)
- Sharing the map with others (if that was ever needed)

### Mitigation
The visual map on WhatsApp (with status indicators) covers 90% of the visual need. For the remaining 10% — when Max genuinely wants to see the spatial big picture — Alex can generate a formatted diagram on demand. If Max later decides he wants a visual tool, the project graph data can be exported to any mind mapping tool at any time.

---

## Dependency Tracking

Workstreams don't exist in isolation — they depend on each other. Alex tracks these dependencies and flags when a bottleneck in one area is blocking another.

### Dependency Types

```sql
CREATE TABLE project_dependencies (
  id SERIAL PRIMARY KEY,
  blocking_node_id INTEGER REFERENCES project_nodes(id),
  blocked_node_id INTEGER REFERENCES project_nodes(id),
  dependency_type VARCHAR(50),          -- 'blocks', 'feeds_into', 'requires_output_from'
  description TEXT,                     -- "Min Bui needs Farhan's creatives before the landing page"
  status VARCHAR(20) DEFAULT 'active',  -- 'active', 'resolved', 'bypassed'
  discovered_via VARCHAR(50),           -- 'max_direct', 'whatsapp_monitoring', 'alex_inference'
  created_at TIMESTAMP DEFAULT NOW()
);
```

### How Dependencies Are Discovered

**From Max directly:**
- "Min Bui can't start the landing page until Farhan delivers the creatives" → creates a dependency

**From WhatsApp monitoring:**
- Min Bui messages: "Still waiting on Farhan's banner assets before I can finish the landing page" → Alex infers and creates a dependency
- Usman messages: "The bot can't go live until the API endpoint is ready from Epixel" → dependency logged

**From Alex's inference:**
- Farhan's creatives are overdue → Min Bui's node shows no progress → Alex asks: "Min Bui hasn't updated CRO in 8 days. Could this be because Farhan's creatives are still pending?"

### Dependency Alerts

When a blocking node is stalled, overdue, or has a status change, Alex checks all downstream dependencies:

```
⚠️ Dependency alert:
Farhan's Q1 creatives (Jobpeak > Bombay Media) are 3 days overdue.
This is blocking:
• Min Bui — Jobpeak landing page redesign
• Arnav — Social media content for Q1 campaign

Want me to chase Farhan?
```

---

## Workload Analysis

Alex can assess whether team members are overloaded, underutilised, or balanced.

### Per-Person Workload View

Max asks: "Who's overloaded?"

Alex compiles:
```
👥 Team Workload:

🔴 Diyan — 4 active workstreams across 2 projects
   Jobpeak email automation, Jobpeak WA outreach,
   Tutorii email automation, Tutorii WA outreach
   Last update: 2 days ago. May be stretched thin.

🟡 Min Bui — 3 active workstreams across 2 projects
   Jobpeak CRO, Tutorii UX, Jobpeak landing page (blocked)
   Active but one workstream is waiting on Farhan.

🟢 Farhan — 1 active workstream
   Jobpeak Bombay Media creatives
   But 3 days overdue on Q1 deliverable.

🟢 Arnav — 1 active workstream
   Jobpeak social media
   On schedule. Last update: yesterday.

⚪ Corylus — 1 workstream, low activity
   Chickerell planning
   Last update: 12 days ago.
```

### Resource Conflict Detection

When the same person is assigned across multiple projects, Alex watches for conflicts:
- "Diyan is handling email automation for both Jobpeak and Tutorii. His output on Tutorii has slowed this month — could be a capacity issue."
- "Min Bui has 3 active workstreams. Want me to check if prioritisation is needed?"

---

## Trend Detection

Alex analyses patterns in the project graph over time, not just point-in-time snapshots.

### Project Health Trends

```json
{
  "project": "Jobpeak",
  "trend": "declining_activity",
  "detail": "Updates per week dropped from 12 (February) to 5 (March so far). Marketing workstreams are active but Platform Dev has gone quiet.",
  "recommendation": "Check in with Min Bui and Epixel on Jobpeak platform work."
}
```

### Person Activity Trends

```json
{
  "person": "Farhan",
  "trend": "delivery_slippage",
  "detail": "Last 3 deliverables were each 2-4 days late. Previously delivered on time consistently.",
  "recommendation": "May be worth a conversation about capacity or blockers."
}
```

### What Alex Reports in Briefings

- "Jobpeak activity has dropped 60% this month compared to last — mainly Platform Dev."
- "Farhan's last 3 deliverables have been late. This is a change from his usual pattern."
- "Chickerell has had no updates across any workstream for 10 days."
- "Tutorii is the most active project this week — 8 updates across 3 workstreams."

---

## Cross-Project Intelligence

Alex identifies connections, conflicts, and opportunities across projects that Max might miss:

### Shared Resource Conflicts
- "Diyan is juggling email work for both Jobpeak and Tutorii. His Tutorii output has dropped — might be worth prioritising."
- "Min Bui is assigned to both Jobpeak CRO and Tutorii UX. Do you want these done in parallel or sequenced?"

### Pattern Transfer
- "The WhatsApp bot Usman built for Jobpeak could be adapted for Tutorii. Want me to raise this with him?"
- "Farhan's Jobpeak creative template could work for Premierblueprint marketing — similar brand style."

### Strategic Connections
- "Jobpeak and Tutorii both target the UAE market. Any cross-promotion planned?"
- "Chickerell accounting is up to date, but you haven't reviewed financial summaries for Jobpeak or Tutorii in 3 months."

---

## Accountability Tracking

Alex helps Max hold people accountable without being confrontational.

### Promise Tracking

When someone says they'll do something, Alex logs it:

| Source | Promise | Person | Deadline | Status |
|--------|---------|--------|----------|--------|
| WhatsApp | "I'll have the creatives done by Friday" | Farhan | Mar 14 | Pending |
| Email | "Planning application submitted, expect response in 2 weeks" | Corylus | Mar 18 | Pending |
| Max's instruction | "Tell Usman I need the bot by end of March" | Usman | Mar 31 | Communicated |

### Overdue Promise Alerts

When a promise passes its deadline:
```
🚨 Overdue promise:
Farhan said he'd have the Q1 creatives done by Friday (Mar 14).
It's now Monday and no delivery. Last WhatsApp message from Farhan was Thursday.

Want me to chase him?
```

### Delivery History

Max asks: "Is Farhan reliable?"

Alex compiles:
```
Farhan — delivery track record (last 6 months):

✅ On time: 8 deliverables
⚠️ 1-3 days late: 3 deliverables
🚨 4+ days late: 1 deliverable

Average delivery: 0.8 days after deadline
Trend: last 3 were late (previously consistent)
Communication: responsive, usually replies within 2 hours
```

---

## End of Project Intelligence Engine