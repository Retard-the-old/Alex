# Alex — Knowledge Store Schema & Daily Briefing

> The Knowledge Store holds Max's personal facts, key dates, preferences, and notes.
> The Daily Briefing is a scheduled prompt that compiles Max's morning digest.

---

## Knowledge Store Schema

The knowledge store is a persistent database (PostgreSQL) of personal facts and notes. Not documents — those go in Google Drive. Subject to the same registered-number access control as Drive.

### Categories & Fields

```sql
-- Personal Information
CREATE TABLE knowledge_store (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  key VARCHAR(100) NOT NULL,
  value TEXT NOT NULL,
  is_sensitive BOOLEAN DEFAULT false,
  expiry_date DATE,                    -- for items with expiry tracking
  reminder_before_days INTEGER,         -- days before expiry to remind
  reminder_recurring VARCHAR(50),       -- 'daily', 'weekly:monday', 'monthly:1', etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  source VARCHAR(50),                   -- 'max_direct', 'email', 'document_extraction'
  UNIQUE(category, key)
);
```

### Seed Data Structure

| Category | Key | Example Value | Sensitive | Expiry Tracking |
|----------|-----|---------------|-----------|-----------------|
| personal | full_name | Max [surname] | No | — |
| personal | dob | YYYY-MM-DD | Yes | — |
| personal | nationality | British | No | — |
| personal | ni_number | XX-XX-XX-XX-X | Yes | — |
| personal | nhs_number | XXX-XXX-XXXX | Yes | — |
| personal | driving_licence | XXXXXX | Yes | Expiry: date |
| personal | tax_reference | XXXXXXXXXX | Yes | — |
| documents | passport_number | ****7293 (masked) | Yes | Expiry: date, remind 90 days |
| documents | passport_expiry | YYYY-MM-DD | No | Remind 90 days before |
| documents | visa_expiry_wife | YYYY-MM-DD | No | Remind 90 days before |
| access_codes | alarm_code_home | XXXX | Yes | — |
| access_codes | safe_combination | XXXXX | Yes | — |
| access_codes | gate_code | XXXX | Yes | — |
| access_codes | wifi_office | XXXXXXXX | Yes | — |
| contacts | gp_name | Dr. [name] | No | — |
| contacts | gp_phone | +44XXXXXXX | No | — |
| contacts | accountant_name | [name] | No | — |
| contacts | accountant_phone | +44XXXXXXX | No | — |
| contacts | solicitor_name | [name] | No | — |
| key_dates | passport_expiry | YYYY-MM-DD | No | Remind 90 days before |
| key_dates | visa_expiry | YYYY-MM-DD | No | Remind 90 days before |
| key_dates | insurance_home_renewal | YYYY-MM-DD | No | Remind 30 days before |
| key_dates | insurance_car_renewal | YYYY-MM-DD | No | Remind 30 days before |
| key_dates | mot_due | YYYY-MM-DD | No | Remind 30 days before |
| preferences | airline | Emirates | No | — |
| preferences | cabin_class_default | Business | No | — |
| preferences | seat_preference | Window | No | — |
| preferences | dietary | [if any] | No | — |
| preferences | hotel_chain | [if any] | No | — |
| loyalty | emirates_skywards | EK-XXXXXXX | No | — |
| loyalty | marriott_bonvoy | [number] | No | — |
| loyalty | hilton_honors | [number] | No | — |
| household | car_registration | XX00 XXX | No | — |
| household | car_make_model | [make/model/year] | No | — |
| household | boiler_model | [model] | No | — |
| household | energy_supplier | [company] | No | — |
| household | energy_account | [number] | Yes | — |
| notes | [freeform key] | [freeform value] | No | — |

## How Reference Data Gets Populated

Alex learns your data through three channels. There is no bulk upload or setup wizard — the knowledge store fills up naturally as you use Alex.

### Channel 1: You Tell Alex Directly (Primary)

Just message Alex with the information, the same way you'd tell a human assistant. Alex extracts the data, categorises it, and stores it.

Examples:
- "My NI number is AB-12-34-56-C" → stores under personal/ni_number
- "My passport expires 14 September 2028" → stores under key_dates/passport_expiry + sets 90-day reminder
- "WiFi password at the office is Neptune2024" → stores under access_codes/wifi_office
- "My Emirates Skywards number is EK-1234567" → stores under loyalty/emirates_skywards
- "My car is a 2019 Range Rover Sport, registration AB19 XYZ" → stores under household
- "Remember: Farhan's wife is called Sarah" → stores under notes
- "My accountant is David Chen, +44 7700 900123" → stores under contacts

Alex confirms what it stored: "Got it — saved your NI number." No need for special formatting or commands.

### Channel 2: Alex Extracts from Documents (Automatic)

When you save a document to Google Drive, Alex can read and extract key data points if relevant:
- Passport scan → extract passport number, expiry date, nationality, full name
- Visa document → extract visa type, expiry date, visa number
- Insurance certificate → extract policy number, renewal date, provider
- Tenancy agreement → extract end date, landlord details, rent amount
- Vehicle registration → extract registration, make/model, MOT date

Alex asks before storing extracted data: "I found your passport expiry is 14 Sep 2028. Save this and set a reminder?" This prevents incorrect extractions from polluting the knowledge store.

### Channel 3: Alex Learns from Context (Passive)

Over time, Alex picks up preferences and patterns from your behaviour:
- You always choose Emirates → Alex notes Emirates as preferred airline
- You always book business class → Alex defaults to business in searches
- You always pick window seats → Alex stores seat preference
- You message at certain times → Alex learns your active hours

Passive learning only applies to preferences, never to sensitive data. Alex confirms before storing: "I've noticed you always prefer Emirates. Want me to default to that for future searches?"

### Updating and Correcting Data

- "Update my car registration to CD21 ABC" → overwrites the old value
- "My passport number has changed — it's now ending 8847" → updates and logs the change
- "Forget my old alarm code" → deletes the entry
- "What do you have stored about me?" → Alex lists all categories and keys (values masked for sensitive items)
- "Show me everything in my key dates" → lists all key_dates entries

### What Alex Never Stores Automatically
- Card numbers (these are tokenised via Duffel, never in the knowledge store)
- Passwords to online accounts
- Information from unverified sources (e.g., a third party claiming Max's details)

### Initial Setup Recommendation

When Alex first goes live, Max can seed the essentials in one conversation:

```
"Let me give you some basics:
- My full name is Max [surname]
- DOB: [date]
- Passport number ending 7293, expires [date]
- NI number: XX-XX-XX-XX-X
- Emirates Skywards: EK-XXXXXXX
- My car is a [make/model], reg [XX00 XXX]
- Home alarm code: [XXXX]
- Accountant: [name], [phone]
- GP: Dr [name], [phone]"
```

Alex processes each line, stores it in the right category, sets up expiry reminders where applicable, and confirms: "All saved. I've set reminders for your passport (90 days before) and will track your key dates. Anything else?"

After that, just tell Alex new things as they come up. The store builds itself.

---

**Store:** "My new NI number is XX-XX-XX-XX-X" → Upsert to knowledge_store(personal, ni_number)
**Retrieve:** "What's my NI number?" → Query knowledge_store WHERE category='personal' AND key='ni_number'
**Update:** "Update my car registration to YY11 YYY" → Update value WHERE category='household' AND key='car_registration'
**Delete:** "Forget my old alarm code" → Delete WHERE category='access_codes' AND key='alarm_code_home'
**List:** "What key dates do I have coming up?" → Query WHERE category='key_dates' ORDER BY value ASC

### Sensitivity Rules
- Sensitive items (is_sensitive=true) are displayed masked in WhatsApp: last 4 characters only
- "What's my passport number?" → "Your passport ends in 7293."
- "Send me my full passport number" → display in full (registered number verified)
- Never include sensitive values in log entries or error messages

---

## Document Storage — Folder Classification Logic

When Max says "save this" with an attachment, Alex must determine the correct Google Drive folder automatically. This requires understanding the document type from its filename, content, and context.

### Classification Prompt

```
Given a document (filename, file type, and optionally extracted text/metadata),
determine the most appropriate Google Drive folder.

Folder options:
- Admin: passports, visas, ID, driving licence, birth certificates, NI card
- Financial: bank statements, tax returns, payslips, P60s, invoices
- Insurance: home, car, travel, health policies and certificates
- Contracts: employment, tenancy, business contracts, legal agreements
- Property: deeds, mortgage documents, surveys, planning permissions
- Medical: medical records, prescriptions, vaccination certificates
- Chickerell: anything explicitly related to the Chickerell project
- Jobpeak: anything explicitly related to Jobpeak
- Tutorii: anything explicitly related to Tutorii
- Premierblueprint: anything explicitly related to Premier Blueprint
- Travel: flight confirmations, hotel bookings, itineraries, travel insurance
- Receipts: purchase receipts, delivery confirmations
- Reference: manuals, guides, how-tos, reference material
- Miscellaneous: default if nothing else fits

Rules:
1. If Max specifies a folder ("save this to Jobpeak") → use that folder, no classification needed
2. If the document clearly belongs to a project (mentions Chickerell, Jobpeak, etc.) → use that project folder
3. If the document type is unambiguous (passport scan → Admin, receipt → Receipts) → classify directly
4. If uncertain between two folders → ask Max: "This looks like it could go in [A] or [B]. Which one?"
5. Never guess on project folders — if it's not clearly project-related, use the content-type folder
6. After storing, confirm: "Saved [filename] to [folder]."
```

### Context-Aware Classification
Alex also uses conversation context to classify:
- Max is discussing Chickerell and sends a document → likely Chickerell folder
- Max just booked a flight and sends a confirmation → Travel folder
- Max forwards an email with an invoice → Financial folder
- Max says "save this for reference" → Reference folder

---

```sql
CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50),                     -- 'restaurant', 'business', 'individual', 'contractor'
  whatsapp VARCHAR(20),
  email VARCHAR(200),
  phone VARCHAR(20),
  website VARCHAR(500),
  booking_platforms JSONB,              -- ["opentable", "resy"]
  address TEXT,
  google_place_id VARCHAR(200),
  google_rating DECIMAL(2,1),
  preferred_channel VARCHAR(20),        -- auto-learned from successful contact
  knows_alex BOOLEAN DEFAULT false,     -- skip identity protocol if true
  discovery_source VARCHAR(50),         -- 'web_search', 'screenshot', 'manual', 'google_places'
  notes TEXT,
  first_contacted TIMESTAMP,
  last_contacted TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE conversation_threads (
  id SERIAL PRIMARY KEY,
  contact_id INTEGER REFERENCES contacts(id),
  task_id VARCHAR(50),
  channel VARCHAR(20),                  -- 'whatsapp', 'email', 'opentable'
  status VARCHAR(20),                   -- 'initiated', 'awaiting_reply', 'in_progress', 'escalated', 'completed', 'stalled'
  disclosure_level INTEGER DEFAULT 1,   -- 1, 2, or 3
  follow_ups_sent INTEGER DEFAULT 0,
  outcome TEXT,
  calendar_event_id VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  thread_id INTEGER REFERENCES conversation_threads(id),
  direction VARCHAR(10),                -- 'inbound' or 'outbound'
  channel VARCHAR(20),
  content TEXT,
  attachments JSONB,
  sent_at TIMESTAMP DEFAULT NOW(),
  approval_status VARCHAR(20),          -- 'autonomous', 'pending', 'approved', 'rejected'
  approved_by VARCHAR(20)               -- 'max' or 'auto'
);
```

---

## Task Tracking Schema

```sql
CREATE TABLE tasks (
  id VARCHAR(50) PRIMARY KEY,           -- TSK-001, TSK-002, etc.
  type VARCHAR(50),                     -- 'restaurant_booking', 'business_enquiry', 'local_search', 'message_individual', 'quote_request'
  source_agent VARCHAR(20),             -- 'task_agent', 'travel_agent', 'mindomo_agent'
  contact_id INTEGER REFERENCES contacts(id),
  status VARCHAR(20),                   -- 'pending', 'in_progress', 'awaiting_approval', 'completed', 'stalled', 'cancelled'
  priority VARCHAR(10) DEFAULT 'normal', -- 'high', 'normal', 'low'
  original_instruction TEXT,            -- Max's exact message
  parsed_intent JSONB,                  -- structured task data
  outcome TEXT,
  calendar_event_id VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  stalled_at TIMESTAMP
);
```

---

## Reminder Schema

```sql
CREATE TABLE reminders (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL,                -- "Call the accountant"
  trigger_type VARCHAR(20),             -- 'datetime', 'relative', 'recurring'
  trigger_datetime TIMESTAMP,           -- for one-off: exact time
  trigger_relative_to VARCHAR(50),      -- for relative: 'passport_expiry'
  trigger_days_before INTEGER,          -- for relative: 90 (days before the reference date)
  recurrence VARCHAR(50),               -- for recurring: 'daily', 'weekly:monday', 'monthly:1'
  next_fire TIMESTAMP,                  -- pre-calculated next trigger time
  status VARCHAR(20) DEFAULT 'active',  -- 'active', 'fired', 'snoozed', 'cancelled'
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Audit Log Schema

```sql
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50),               -- 'drive_access', 'file_share', 'file_store', 'knowledge_access'
  requesting_number VARCHAR(20),
  requesting_channel VARCHAR(20),       -- 'whatsapp', 'email'
  action VARCHAR(100),                  -- 'retrieve_file', 'share_file', 'store_file', 'query_knowledge'
  target VARCHAR(500),                  -- file path, knowledge key, etc.
  access_granted BOOLEAN,
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Daily Briefing Prompt

> Run automatically every day at 11:30 AM Dubai time (UTC+4).
> Also triggered on-demand when Max asks ("Brief me", "What have I got on?", "Catch me up",
> "Good morning", "What's happening today?", "What's my day look like?").
> This is Max's command centre — not just a calendar summary but a full operational picture
> across all businesses, people, and workstreams.

### Prompt

```
Generate Max's daily briefing. This is his command centre — he orchestrates multiple businesses
and teams, so the briefing must show him the state of play across everything he manages.
Pull from ALL data sources: Calendar, Tasks, Travel, Knowledge Store, Project Graph, WhatsApp
monitoring, conversation threads, email threads, and the learning engine.

Omit any section that has no content EXCEPT for Business Status — that always appears.
Be concise — 1-2 lines per item. Flag what needs Max's attention most urgently at the top.

FORMAT:

Good morning Max. Here's where things stand:

⚠️ NEEDS YOUR INPUT
[Items where Alex is blocked waiting for Max's decision — escalated approvals,
 unanswered questions from team members, pending choices. These come first because
 they're blocking progress.]
- [Item]: [What's needed, how long it's been waiting]

🚨 OVERDUE / AT RISK
[Anything that's slipped past a deadline or is at risk of slipping. This includes:
 - Team deliverables past their due date
 - Tasks that have stalled (no response after follow-ups)
 - Deadlines approaching in the next 48 hours with no progress visible
 - Commitments Max made that haven't been actioned yet]
- [Person/Business]: [What's overdue/at risk, by how long, last known status]

📊 BUSINESS STATUS

Chickerell
• Accounting (Adel): [Current status — what he's working on, anything pending, any updates from WhatsApp monitoring]
• Legal (Susan/Jane): [Status — contract progress, compliance items, any recent communications]
• Planning (Corylus): [Status — applications, approvals, timeline updates]
• Overall: [1-line summary of where Chickerell stands]

Jobpeak.net
• Bombay Media / Farhan: [Creative work status — what's in progress, delivered, pending review]
• WhatsApp Bots / Usman: [Dev status — features in progress, bugs, launches]
• Email Bots / Diyan: [Automation status — campaigns, setups, issues]
• Social Media / Arnav: [Content status — scheduled, posted, engagement notes]
• CRO-UX / Min Bui: [Optimisation status — tests running, results, next steps]
• Paid Ads: [Status — paused/active, spend, performance if known]
• SEO/GEO: [Status]
• Overall: [1-line summary]

Tutorii.com
• Platform Dev / Epixel: [Status]
• UX / Min Bui: [Status]
• Email-WA / Diyan: [Status]
• Social Media: [Status]
• Overall: [1-line summary]

Premierblueprint.com
• Platform Dev: [Status]
• Marketing: [Status]
• Overall: [1-line summary]

Other Businesses
• [Any activity]

[NOTE: Only show detail where there's something to report. If a person or workstream
has had no activity or updates since the last briefing, show them as "No updates since [date]"
rather than omitting them — Max needs to see gaps too. Silence can mean a problem.]

📋 YOUR TASKS
[Things Max himself needs to do — not delegated work, but actions on Max's own plate]
- [Task]: [Due/context]

📬 OPEN OUTREACH
[Active conversations Alex is managing with third parties]
- [Business/person]: [Status — awaiting reply, in progress, stalled]

📅 TODAY'S CALENDAR
[Calendar events with times]

✈️ UPCOMING TRAVEL
[Any flights or hotels in the next 7 days]

📌 KEY DATES (next 30 days)
[Expiries, renewals, deadlines]

🔄 SINCE LAST BRIEFING
[Notable things that happened since yesterday's briefing — new information from team
 WhatsApp chats, completed tasks, received documents, mind map changes]

RULES:
- The BUSINESS STATUS section is the core of this briefing — it ALWAYS appears
- Show people even when there's nothing to report — "No updates since [date]" tells Max
  something important (silence can mean a problem)
- NEEDS YOUR INPUT and OVERDUE always come first — they're blocking progress
- Be honest about gaps — if Alex doesn't have visibility on something, say so:
  "No recent WhatsApp activity from Corylus — last update was [date]"
- Use data from ALL sources: Project graph nodes, WhatsApp monitoring, task outcomes,
  calendar events, email threads, conversation threads, documents stored
- Keep each line to 1-2 sentences max — this is a dashboard, not a report
- If everything is genuinely clear across all fronts: still show business status
- Times in Dubai time (GST)
```

### On-Demand Briefing Variants

Max may ask for briefings in different ways. Alex adapts the scope:

| Max Says | What Alex Generates |
|----------|-------------------|
| "Brief me" / "What have I got on?" / "Good morning" | Full briefing (as above) |
| "What's happening with Jobpeak?" | Jobpeak section only, in full detail |
| "What's Farhan doing?" | Everything Alex knows about Farhan's current work across all projects |
| "What's overdue?" | Only the overdue/at risk section, expanded with more detail |
| "What do you need from me?" | Only the needs-your-input section |
| "Give me a quick update" | Compressed: overdue + needs input + 1-line per business |
| "What happened today?" / "End of day summary" | Reverse briefing: what changed since the morning |
| "Catch me up on this week" | Weekly summary (see below) |
| "Who's been quiet?" | People with no updates in an unusually long time |
| "Is anyone stuck?" | Stalled work, overdue items, blocked tasks across all businesses |

### Ad-Hoc Status Queries

Max will frequently ask about specific people or projects mid-conversation. Alex responds with the same depth as the briefing section, drawing from all data sources:

"What's Usman up to?"
→ Alex compiles: last WhatsApp messages from Usman, any project graph updates on his nodes, any tasks involving him, last time Max interacted with him, and any outstanding deliverables.

"Where are we on Chickerell planning?"
→ Alex compiles: Corylus's recent WhatsApp messages, the Planning node in the project graph, any related documents in Drive, any calendar events related to planning, and any outstanding actions.

"Is anyone stuck?"
→ Alex scans all workstreams for: stale project nodes, people who haven't communicated in an unusual number of days, tasks in-progress too long, and escalations waiting for Max.

"What do I owe people?"
→ Alex lists: things Max promised to do/send/decide that are still pending, approvals Alex is waiting for, questions from team members Max hasn't responded to.

---

## Weekly Summary Prompt

> Triggered when Max asks "Summarise my week" or on a scheduled weekly cadence (configurable, e.g. Friday 4pm).

```
Generate Max's weekly summary covering the past 7 days. Focus on outcomes and movement,
not process. This should tell Max: what progressed, what didn't, and what needs attention
going into next week.

FORMAT:

Here's your week in review:

📊 BUSINESS MOVEMENT

Chickerell
• What progressed: [decisions made, milestones hit, documents received]
• What didn't move: [stalled items, unanswered queries, blocked work]
• Next week: [What's needed]

Jobpeak.net
• [Same structure]

Tutorii.com
• [Same structure]

Premierblueprint.com
• [Same structure]

👥 TEAM ACTIVITY
[Per person: what they delivered, what they're behind on, communication frequency]
- Farhan: [summary]
- Usman: [summary]
- Diyan: [summary]
- Arnav: [summary]
- Min Bui: [summary]
- Adel: [summary]
- Susan/Jane: [summary]
- Corylus: [summary]
- Epixel: [summary]

✅ COMPLETED THIS WEEK
[Tasks, bookings, outreach that reached conclusion]

🚨 CARRIED OVER
[Open items rolling into next week, with status and age]

📌 NEXT WEEK LOOKAHEAD
[Calendar events, travel, deadlines, key dates]

RULES:
- Group by business, not chronologically
- Be honest about what didn't move — this is as important as what did
- Per-person summaries should flag anyone who's been unusually quiet
- If a business had zero activity all week, say so explicitly
- Max 3-4 items per business section
- Focus on outcomes: "Booked Emirates to Dubai for March 14" not "Searched for flights..."
```

---

## End of Knowledge Store & Briefing Prompt
