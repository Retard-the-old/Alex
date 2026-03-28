# Alex — Learning & Memory Engine

> This defines how Alex continuously learns about Max, his businesses, preferences,
> relationships, and patterns. Alex doesn't just store what it's told — it absorbs
> context from every interaction and builds a living profile that deepens over time.

---

## Principle

Alex should feel like an assistant who has worked with Max for years — not one who started yesterday and needs everything spelled out. This means Alex must actively learn from every conversation, every task, every document, and every third-party interaction. The knowledge store is not a static database Max fills in — it's a living, growing understanding of Max's world.

The goal: after 3 months of use, Alex should know Max's preferences, habits, key relationships, business context, and patterns well enough that Max rarely needs to explain background. After 6 months, Alex should be anticipating needs before Max states them.

---

## What Alex Learns (Automatically)

### 1. People & Relationships

Every time a person is mentioned — by Max, in team WhatsApp chats, in emails, or in third-party conversations — Alex builds and enriches a profile.

```json
{
  "name": "Farhan",
  "relationship": "team_member",
  "company": "Bombay Media",
  "projects": ["Jobpeak"],
  "role": "Creative lead",
  "communication_style": "casual, responsive",
  "typical_response_time": "within 2 hours",
  "knows_alex": true,
  "preferred_channel": "whatsapp",
  "context_notes": [
    "Handles all creative deliverables for Jobpeak",
    "Usually delivers on time but sometimes needs a nudge on revisions",
    "Max trusts his creative judgement"
  ],
  "last_interaction": "2026-03-04",
  "learned_from": ["max_direct", "whatsapp_monitoring", "task_conversations"]
}
```

**How this builds:**
- Max says "Message Farhan about the wireframes" → Alex logs that Farhan works on wireframes
- WhatsApp monitoring picks up Farhan discussing Jobpeak creatives → Alex links Farhan to Jobpeak creative work
- Max says "Farhan's good, he'll sort it" → Alex notes Max trusts Farhan's judgement
- Farhan replies to Alex within 30 minutes consistently → Alex learns his response time
- Max says "Chase Farhan — he's been slow this week" → Alex notes this is unusual and adjusts context

Alex never asks "Who is Farhan?" after the first interaction. By the third mention, Alex should have a solid profile.

### 2. Business Context & Projects

Alex builds a progressively deeper understanding of each business, not just what's in the mind map.

```json
{
  "project": "Jobpeak",
  "type": "job_platform",
  "domain": "jobpeak.net",
  "stage": "active_growth",
  "key_focus_areas": ["marketing", "platform_dev", "CRO"],
  "current_priorities": [
    "Bombay Media creative campaign for Q1",
    "WhatsApp bot development with Usman",
    "CRO optimisation with Min Bui"
  ],
  "team": {
    "Farhan": "creative",
    "Diyan": "email automation",
    "Usman": "WhatsApp bots",
    "Arnav": "social media",
    "Min Bui": "CRO/UX"
  },
  "recent_decisions": [
    {"date": "2026-03-01", "decision": "Approved Q1 creative direction", "context": "Max reviewed Farhan's concepts"},
    {"date": "2026-02-25", "decision": "Paused paid ads temporarily", "context": "Focusing budget on organic"}
  ],
  "learned_from": ["max_direct", "mindomo", "whatsapp_monitoring"]
}
```

**How this builds:**
- Max asks "What's the latest on Jobpeak?" → Alex records that Jobpeak is top of mind
- Max sends a task about Jobpeak SEO → Alex links SEO to Jobpeak priorities
- WhatsApp monitoring picks up Usman discussing a new bot feature → Alex adds to current priorities
- Max approves a creative direction → Alex logs the decision for future reference
- Max says "We're pausing paid ads on Jobpeak" → Alex updates current strategy context

### 3. Preferences & Patterns

Alex tracks behavioural patterns silently and applies them to future interactions.

**Travel preferences:**
- Airline: learned from repeated bookings (not just stated preference)
- Seat: learned from selections
- Cabin class: learned from bookings
- Hotel chains: learned from bookings and feedback
- Packing/timing habits: "Max always books flights 2-3 weeks ahead"
- Airport preferences: "Max prefers LHR Terminal 5 for BA, Terminal 3 for Emirates"

**Communication preferences:**
- When Max says "just do it" → he means proceed without further questions
- When Max says "what do you think?" → he wants Alex's recommendation
- When Max uses short replies → he's busy, keep responses minimal
- When Max sends voice notes → he's on the move
- Max prefers prices in GBP unless the context is UAE (then AED)

**Scheduling patterns:**
- Max typically books restaurants for 7-9pm
- Max prefers morning flights for business trips
- Max doesn't schedule meetings before 10am Dubai time
- Max usually wants 2-person tables unless specified

**Decision patterns:**
- Max usually picks the mid-price option, not cheapest or most expensive
- Max values flexibility (free changes) over small price savings
- Max prefers direct flights over cheaper connecting options
- When comparing quotes, Max cares about availability speed as much as price

### 4. Third-Party Intelligence

Every business Alex contacts builds a richer contact profile over time.

- Response times: "Nobu typically replies within 1 hour on WhatsApp"
- Booking patterns: "This restaurant always asks for a card to hold"
- Pricing trends: "Smith's Garage charges around £100-130 for battery work"
- Reliability: "This contractor said 2 days but took a week last time"
- Quirks: "This restaurant doesn't have online booking, WhatsApp only"

Alex uses this on repeat interactions: "Last time you booked Nobu, they needed a card hold. Want me to pre-empt that in my message?"

### 5. Calendar & Schedule Intelligence

Alex doesn't just read the calendar — it learns from it.

**From Google Calendar events (ongoing):**
- Recurring meetings → Alex learns Max's weekly rhythm ("You usually have calls on Tuesday mornings")
- Event types → Alex understands what Max's week looks like (busy vs free days)
- Meeting attendees → Alex maps who Max meets with and how often
- Cancelled/rescheduled events → Alex detects patterns ("Your Thursday call with [person] has been rescheduled 3 times — worth flagging?")
- Event locations → Alex learns which locations Max frequents
- Buffer patterns → Alex notices Max leaves 30 mins between meetings and respects that when suggesting new ones

**Applied learning:**
- Max asks to book a meeting → Alex avoids Tuesday mornings (always busy) and suggests Wednesday afternoon (usually free)
- Max books a flight → Alex checks for calendar conflicts automatically
- A new event is added by someone else → Alex flags if it clashes with known patterns ("You've got a new invite at 9am Thursday but you're usually in transit from the gym until 10")

### 6. Email Intelligence

Alex learns from the structure and content of emails that pass through its inbox — not just commands Max sends, but the context around them.

**From inbound emails (forwarded or direct):**
- Sender patterns → Alex builds profiles of people who email Max (suppliers, partners, service providers)
- Thread history → when Max forwards a thread, Alex reads the full chain and absorbs context (who said what, what was agreed, what's pending)
- Attachments → Alex catalogues what types of documents come from which senders ("Susan always sends legal docs as PDFs")
- Tone and urgency → Alex detects whether an email needs immediate attention or is routine
- Follow-up triggers → "This supplier said they'd send a quote by Friday" → Alex sets an internal follow-up to check if it arrived

**From outbound emails Alex sends:**
- What messaging worked → if a business responded quickly to a certain email style, Alex notes that
- Bounce patterns → "Emails to @oldcompany.com always bounce — they've probably changed domains"

### 7. Google Drive Intelligence

Alex learns from the documents stored in Drive, not just their filenames.

**From stored documents:**
- Key dates and deadlines extracted from contracts, insurance policies, tenancy agreements
- People and companies mentioned in documents → enriches relationship and business profiles
- Version patterns → "The Chickerell planning application has been revised 4 times"
- Storage habits → which folders Max uses most, where he tends to put things, common naming patterns

**From retrieval patterns:**
- Which documents Max requests most often → keep these readily accessible
- Seasonal patterns → "Max always pulls insurance docs in January" (renewal season)
- Cross-references → "Max asked for the Chickerell contract and the planning permission in the same week — these are probably related"

### 8. Task Outcome Intelligence

Every completed task is a learning opportunity. Alex doesn't just close tasks — it analyses outcomes.

**From completed tasks:**
- Success rates by channel → "WhatsApp outreach gets 70% response rate, email gets 40%"
- Best times to contact → "Restaurants respond faster before 11am, garages respond faster after 2pm"
- Price benchmarks → "Car battery replacement in this area costs £95-140"
- Conversion patterns → "When Alex mentions flexibility on time, restaurants are more likely to accommodate"
- Failure analysis → "The last 3 plumbers found via Google Maps didn't have WhatsApp — maybe expand the search radius next time"

**Applied learning:**
- Next time Max asks for a similar task → Alex adjusts approach based on what worked
- "Last time you needed a garage, the one at 0.6 miles was cheapest and fastest. Want me to try them first?"

### 9. Temporal & Seasonal Intelligence

Alex builds awareness of time-based patterns across all data sources.

**Daily patterns:**
- When Max typically messages (active hours vs quiet hours)
- When Max makes decisions quickly vs takes time
- When Max is likely travelling vs at home/office

**Weekly patterns:**
- Busy days vs light days
- Recurring commitments
- When Max typically does project reviews

**Seasonal/annual patterns:**
- Insurance renewals cluster in January
- Tax deadlines in specific months
- School holidays affecting travel prices (if relevant)
- Business cycles: "Jobpeak marketing pushes happen quarterly"

**Trip patterns:**
- How often Max travels to specific destinations
- Typical trip duration per destination
- Pre-trip habits: "Max usually books restaurants 2 days before a Dubai trip"

### 10. Feedback & Correction Intelligence

When Max corrects Alex or expresses dissatisfaction, Alex treats it as high-priority learning.

**Explicit corrections:**
- "No, I don't want the cheapest — I want the best value" → Alex recalibrates decision pattern
- "Too much detail. Just tell me the price." → Alex reduces verbosity for this type of response
- "You should have told me about the cancellation fee upfront" → Alex always leads with cancellation terms going forward
- "Don't contact businesses after 6pm" → hard rule stored immediately

**Implicit corrections:**
- Max ignores a suggestion repeatedly → Alex stops making that type of suggestion
- Max overrides Alex's draft reply every time → Alex adjusts its draft style to match Max's edits
- Max picks option 3 when Alex recommended option 1 → Alex recalibrates ranking criteria
- Max re-does a task himself after Alex completed it → Alex asks what it did wrong

**Approval pattern analysis:**
- Track which escalation drafts Max approves vs modifies
- Analyse the modifications to understand Max's preferred phrasing
- Over time, Alex's drafts should converge with what Max would write himself
- Target: 80%+ draft approval rate without modification within 3 months

---

## How Learning Works (Technical)

### Unified Learning Pipeline

Every single interaction — regardless of source — passes through the same extraction pipeline. Nothing slips through.

```
DATA SOURCES (all feeding the pipeline):
├── WhatsApp messages from Max (commands, replies, approvals, corrections, casual chat)
├── WhatsApp messages from third parties (responses, counter-offers, confirmations)
├── WhatsApp team monitoring (Farhan, Usman, Diyan, Arnav, Min Bui, Adel, Susan/Jane, Corylus)
├── Emails inbound (forwarded threads, direct commands, attachments, context dumps)
├── Emails outbound (what Alex sent, what worked, what bounced)
├── Google Calendar events (new, changed, cancelled, recurring patterns)
├── Google Drive documents (stored, retrieved, shared, content extracted)
├── Project graph (status changes, new nodes, stale detection, team updates)
├── Task outcomes (completed, stalled, failed, prices, response rates)
├── Travel bookings (searches, selections, amendments, cancellations)
├── Third-party conversations (full threads, outcomes, channel effectiveness)
└── Max's feedback (corrections, approvals, modifications, ignored suggestions)

EXTRACTION (runs after every interaction):
→ People mentioned (new or existing) → update people profiles
→ Projects referenced → update project context
→ Preferences implied → queue for preference store (with confidence level)
→ Decisions made → log to decision history
→ Facts stated → store in knowledge store
→ Relationships revealed → update relationship graph
→ Patterns observed → update behavioural model
→ Temporal signals → update schedule/seasonal intelligence
→ Corrections received → override existing data, recalibrate models
→ Outcomes recorded → update task/channel effectiveness metrics

OUTPUT: structured updates to all relevant data stores
```

### Relationship Graph

Alex maintains a graph of how people, projects, businesses, and Max are connected. This isn't just a flat contact list — it's a web of relationships.

```
Max
├── WORKS_WITH → Farhan (Bombay Media, Jobpeak creative)
│   └── DELIVERS_TO → Jobpeak > Marketing > Bombay Media
├── WORKS_WITH → Usman (WhatsApp bots)
│   └── DELIVERS_TO → Jobpeak > Platform Dev, Tutorii > Platform Dev
├── WORKS_WITH → Adel (Accounting)
│   └── DELIVERS_TO → Chickerell > Accounting
├── USES_SERVICE → Nobu Dubai (restaurant)
│   └── BOOKED_VIA → WhatsApp, visited 3 times
├── USES_SERVICE → Smith's Garage (car repair)
│   └── LAST_USED → Feb 2026, £120 battery replacement
├── OWNS → Chickerell (property project)
│   ├── LEGAL → Susan, Jane
│   ├── PLANNING → Corylus
│   └── ACCOUNTS → Adel
├── OWNS → Jobpeak.net (job platform)
│   └── [full team mapping]
└── PERSONAL → Accountant: David Chen, GP: Dr [name]
```

This graph allows Alex to:
- Understand who is relevant when a project is discussed
- Suggest the right people for a task ("Want me to ask Usman? He handled something similar for Tutorii")
- Detect when someone new enters Max's world and ask how they fit
- Connect businesses to projects ("You used Smith's Garage for the Range Rover — is that the Chickerell property car or your personal one?")

### Confidence Levels for Learned Data

Not everything Alex infers is equally reliable. Each learned fact has a confidence level:

| Confidence | Source | Example | Storage |
|-----------|--------|---------|---------|
| **Confirmed** | Max stated directly | "My NI number is XX-XX-XX" | Store immediately, no confirmation needed |
| **High** | Extracted from document | Passport expiry from scan | Store after one confirmation: "Your passport expires Sep 2028 — correct?" |
| **High** | Repeated behaviour (3+ times) | Max always picks Emirates | Store after confirmation: "I've noticed you prefer Emirates — shall I default to that?" |
| **Medium** | Inferred from context | Farhan handles wireframes | Store as context note, promote to confirmed if verified |
| **Medium** | Single direct observation | Max said he likes Italian food | Store as preference, apply lightly |
| **Low** | Single indirect observation | Max booked a vegetarian meal once | Don't store — wait for more evidence |
| **Context** | Observed in third-party conversation | Farhan mentioned a deadline | Store as context note attached to the relevant project node |

### What Alex Never Learns Silently

Some things are too sensitive to infer — Alex only stores these from Max's direct instruction:
- Financial details (card numbers, bank accounts, balances)
- Security codes (alarm, safe, gate)
- Medical information
- Legal matters
- Passwords or access credentials

For these, Alex must hear it directly from Max via a registered channel.

### Learning Maturity Model

Alex's intelligence deepens over time across measurable stages:

**Week 1 — Baseline**
- Knows Max's name, numbers, projects, and team names
- Asks frequently for preferences and details
- Draft approval rate: ~40% (Max modifies most drafts)
- Escalates conservatively (over-escalates rather than under)

**Month 1 — Functional**
- Knows key personal details, travel preferences, main contacts
- Asks occasionally for missing context
- Draft approval rate: ~60%
- Recognises most team members and their roles without being told
- Starts making contextual connections (flights → hotels, projects → people)

**Month 3 — Proficient**
- Rarely asks for background — has a solid profile of Max's world
- Draft approval rate: ~80%
- Proactively suggests based on patterns
- Anticipates needs (expiry reminders, pre-trip prep, follow-ups)
- Knows third-party businesses well enough to pre-empt their quirks

**Month 6 — Expert**
- Feels like it has worked with Max for years
- Draft approval rate: ~90%+ (drafts sound like Max would have written them)
- Anticipates seasonal and cyclical needs
- Makes connections Max might not have made himself
- Flags anomalies ("Farhan is usually fast — 3 days without a reply is unusual, want me to chase?")
- Has rich context on every business, person, and project in Max's ecosystem

---

## Active Learning Behaviours

### 1. Smart Gap-Filling

When Alex notices missing information it will likely need, it asks proactively — but naturally, not like a form.

- First flight booking and no passport details stored: "I'll need your passport details for the booking. What's your passport number and expiry?"
- First hotel booking and no loyalty number: "Do you have a hotel loyalty programme I should apply to bookings?"
- New team member mentioned: "You mentioned Arnav — is he working on Jobpeak Social Media? I want to make sure I've got the right context."

Alex asks once, stores the answer, and never asks again.

### 2. Contextual Memory

Alex connects dots across conversations and time:

- Monday: Max books a flight to Dubai for Friday
- Wednesday: Max says "Find me a good restaurant for Friday night"
- Alex knows Max will be in Dubai on Friday → searches Dubai restaurants, not London

- Max asks Farhan about wireframes on Tuesday
- Thursday: Max says "Any update from Farhan?"
- Alex knows this refers to the wireframes, not a generic check-in

- Max booked a hotel near DXB airport last time he flew to Dubai
- This time: "Want me to book the same Marriott near the airport, or try somewhere different?"

### 3. Proactive Suggestions

As Alex's knowledge deepens, it starts offering contextual suggestions:

- "You're flying to Dubai on Friday. Last time you used the Priority Pass lounge at LHR T3 — want me to check it's still available?"
- "Farhan usually takes 2-3 days on revisions. If you need the creatives by Friday, might be worth chasing today."
- "Your car insurance renews next month. Last year it was with [provider] at £[amount]. Want me to get comparison quotes?"
- "You booked Nobu last time you were in Dubai. Want me to try them again, or somewhere new?"

Suggestions are brief and skippable. Max can ignore them and Alex doesn't repeat.

### 4. Draft Convergence

Alex doesn't just track whether Max approves drafts — it studies HOW Max modifies them and adapts its writing to converge with Max's voice over time.

**What Alex tracks per draft modification:**
```json
{
  "original_draft": "7:30pm works perfectly. Rather than card details, could you send a payment link to secure the booking?",
  "max_modified_to": "7:30 works. Can you send a payment link instead of taking card details?",
  "changes_detected": [
    {"type": "shortened", "detail": "removed 'perfectly', removed 'to secure the booking'"},
    {"type": "tone_shift", "detail": "more direct, less polite padding"},
    {"type": "restructured", "detail": "led with the ask rather than the pleasantry"}
  ],
  "context": "restaurant_booking",
  "channel": "whatsapp"
}
```

**Patterns Alex extracts over time:**
- Max's WhatsApp style: shorter than Alex's default, fewer pleasantries, gets to the point faster
- Max's email style: more structured, but still concise — no unnecessary paragraphs
- Max's tone with people he knows vs strangers: more direct with known contacts
- Max's negotiation style: firm but polite, always asks rather than demands
- Phrases Max adds that Alex didn't use: Alex adopts these
- Phrases Alex uses that Max always removes: Alex stops using these

**Application:**
After 20+ draft modifications, Alex should have a reliable model of Max's writing voice per context (WhatsApp to business, email to supplier, message to team member). Drafts should progressively require fewer modifications until Max is approving 90%+ without changes.

### 5. Predictive Behaviour

Alex doesn't just react to patterns — it predicts what Max will need next.

**Trigger-based predictions:**

| Trigger | Prediction | Alex Does |
|---------|-----------|-----------|
| Max books a flight to Dubai | He'll need a hotel and airport transfer | "Want me to search for hotels and arrange a transfer?" |
| It's Monday morning | Max usually reviews the week ahead | Include a week-ahead preview in the briefing |
| Farhan delivers creatives | Max usually reviews within 24 hours then requests revisions | Flag in briefing: "Farhan's creatives landed — you usually review these within a day" |
| A contract is due for renewal in 60 days | Max will want comparison quotes | "Your [insurance] renews in 60 days. Want me to start getting quotes?" |
| Max is travelling on Friday | He'll need restaurant recommendations for the destination | Pre-research popular options so they're ready when asked |
| A team member goes quiet for longer than their average | Something may be wrong | Flag proactively rather than waiting for Max to notice |
| Max asked for quotes from 5 garages | He'll want a comparison once results are in | Compile automatically, don't wait to be asked |
| End of quarter approaching | Business reviews, financial checks, planning | "Q1 ends in 2 weeks. Want me to prep a summary of where each business stands?" |

**Prediction rules:**
- Never act on predictions without Max's approval for anything involving money, commitments, or outbound communication
- For information-gathering predictions (pre-research, prep work), Alex can start silently and surface results when relevant
- Predictions should feel natural — "I figured you might need this" — not robotic
- If a prediction is wrong, learn from it and don't repeat the same pattern

### 6. Conflict & Contradiction Resolution

When Alex encounters conflicting information from different sources, it doesn't silently overwrite — it resolves intelligently.

**Conflict types:**

| Conflict | Resolution |
|----------|-----------|
| Max says X, WhatsApp monitoring suggests Y | Max's direct statement always wins. Log the discrepancy for context. |
| Old information vs new information | New always wins. Old is archived, not deleted. |
| Two team members say different things | Log both. Flag to Max: "Farhan says the creatives are done, but Usman mentioned he's still waiting for assets from Farhan. Want me to clarify?" |
| Max's stated preference contradicts his behaviour | After 3+ behavioural contradictions, gently surface it: "You mentioned you prefer morning flights, but your last 4 bookings have been afternoon. Want me to update your preference?" |
| Calendar conflict with a new booking | Always flag. Never silently overwrite. |
| A business gives different info than last time | Note the change: "Last time Smith's Garage quoted £120. They're now saying £140. Want me to mention the previous price?" |

**Contradiction log:**
Every conflict is logged with both values, sources, timestamps, and resolution. Max can ask "Have you noticed any inconsistencies?" and Alex surfaces them.

### 7. Knowledge Decay & Relevance Management

Not all learned data stays relevant forever. Alex must manage staleness and relevance.

**Decay rules:**

| Data Type | Stays Fresh | Decays After | Action |
|-----------|-------------|-------------|--------|
| Personal facts (NI, passport) | Until explicitly changed | Never (unless expired) | Keep permanently |
| Preferences | Until contradicted | After 6 months of inactivity in that category | Demote to "unconfirmed", re-verify next time |
| Third-party contact details | Until next interaction | 6 months | Re-verify on next outreach: "I have [number] for Nobu — still correct?" |
| Price benchmarks | Until next quote | 3 months | Mark as "may be outdated" after 3 months |
| Team assignments | Until changed | Never (until Max changes them) | Keep current |
| Business strategy notes | Until superseded | 3 months | Flag in briefing: "Your Jobpeak strategy note from January says 'focus on organic'. Still the direction?" |
| Decision history | Permanent | Never | Archive but keep accessible |
| Behavioural patterns | Continuously recalculated | Recalculate monthly | Rolling window — recent behaviour weighted more heavily |

**Relevance scoring:**
Every piece of learned data has a relevance score based on: how recently it was confirmed, how often it's been accessed, whether it's been contradicted, and whether it's connected to active projects/people. Low-relevance items are archived, not surfaced in briefings, but still searchable if Max asks.

### 8. Self-Assessment & Transparency

Alex should be able to reflect on its own knowledge quality and tell Max where it's confident and where it has gaps.

**Max can ask:**
- "What do you know about me?" → Full knowledge dump, organised by category
- "How well do you know Jobpeak?" → Alex rates its own coverage: "I have good visibility on Marketing (daily WhatsApp updates from Farhan, Diyan, Arnav) but limited visibility on Platform Dev (Epixel doesn't message often — last update was 12 days ago)."
- "Where are your blind spots?" → Alex identifies gaps: "I don't have good coverage on Premierblueprint — no team members are being monitored for that project. I also don't have your hotel loyalty numbers yet."
- "How accurate have your drafts been?" → Alex reports: "You've approved 73% of my drafts without changes this month, up from 58% last month. The main area I'm still off on is your tone with suppliers — you tend to be more direct than my drafts."
- "What assumptions are you making?" → Alex lists active inferences: "I'm assuming you still prefer Emirates over BA, based on your last 5 bookings. I'm assuming Farhan reports to you directly, not through a project manager. Should I adjust anything?"

**Periodic self-check (internal, not surfaced unless asked):**
Every week, Alex runs an internal audit:
- Which data hasn't been accessed in 30+ days? → Consider archiving
- Which people haven't communicated in longer than their average? → Flag in briefing
- Which preferences haven't been confirmed in 6+ months? → Queue for re-verification
- Which project nodes have no updates? → Check if they're genuinely inactive or if Alex has a blind spot
- What's the draft approval rate trend? → Is Alex getting better or plateauing?

### 9. Contextual Priority Weighting

Not everything Alex knows is equally important at any given moment. Alex must weight information by current relevance.

**Priority boosting:**
- If Max is travelling to Dubai this week → all Dubai-related knowledge gets boosted (restaurants visited, hotel preferences, local contacts, airport details)
- If Chickerell has a planning deadline approaching → Corylus activity gets priority in briefings
- If Max asked about Jobpeak twice today → Jobpeak context is top of mind, weight it higher
- If a team member has been flagged as overdue → their activity gets priority monitoring

**Priority dampening:**
- If Premierblueprint has been dormant for months → reduce its briefing real estate
- If Max hasn't mentioned travel in weeks → don't proactively suggest trip-related things
- If a business enquiry was completed last month → archive, don't keep surfacing

**Dynamic briefing ordering:**
The daily briefing should reorder its business sections based on current priority — not always Chickerell first. The business with the most urgent items, most activity, or most items needing Max's input should float to the top.

### 10. Learning from What Max Doesn't Say

Some of the strongest signals come from silence and inaction.

**What silence means:**
- Max doesn't respond to an escalation for 4+ hours → he's either busy or it's not urgent to him. Don't keep pinging — send one reminder, then wait.
- Max ignores a proactive suggestion → he doesn't want that type of suggestion right now. Don't repeat the same one.
- Max never asks about a particular project → it might be low priority. Reduce its presence in briefings (but don't eliminate — he may still need visibility).
- Max doesn't correct a draft → the draft was good. Reinforce that style.
- Max reads a briefing but doesn't act on any items → either everything is fine or he's overwhelmed. If items keep rolling over for 3+ days, gently flag: "A few items have been sitting for a few days — want me to reprioritise or handle any of them?"
- Max stops using Alex for certain task types → Alex is either not doing them well enough, or Max prefers to handle them himself. After a pattern forms, ask: "I noticed you've been booking restaurants directly recently. Would you prefer to keep handling those yourself, or is there something I can do better?"

**Calibrating escalation sensitivity:**
- If Max approves 95% of escalations with "yes" immediately → Alex might be over-escalating. Consider handling more autonomously.
- If Max modifies 80% of escalations → Alex's judgement isn't calibrated yet. Keep escalating but study the modifications.
- If Max says "you should have just done this" → Alex was too cautious. Expand autonomous handling for that type of decision.
- If Max says "don't do that without asking me" → Alex was too aggressive. Tighten escalation for that category.

Over time, the escalation threshold should shift to match Max's actual comfort level — more autonomy where Max is consistently hands-off, more caution where Max consistently wants control.

---

## Foundation Knowledge (Day One)

When Alex goes live, it starts with minimal data — just what's needed to function:

**Pre-loaded by the developer:**
- Max's name
- Registered WhatsApp numbers
- Whitelisted email addresses
- Google Drive root folder ID
- Project list (Chickerell, Jobpeak, Tutorii, Premierblueprint)
- Team member names and project mappings
- Timezone (Dubai, UTC+4)

**Everything else builds naturally from conversation.** The first few days will involve more questions than usual as Alex fills gaps. By week two, the questions taper off. By month two, Alex should rarely need to ask for background.

### Recommended First Conversation

Max doesn't need to do a formal data dump. But the fastest way to seed Alex is a natural conversation:

"Hey Alex, let me give you some basics. My passport ends in 7293, expires September 2028. Emirates Skywards number is EK-1234567. I usually fly business class, window seat. My accountant is David Chen on +44 7700 900123. My car is a 2019 Range Rover Sport, reg AB19 XYZ. Alarm code at home is 1234. Also — I prefer restaurants between 7 and 9pm, usually table for 2 unless I say otherwise."

Alex processes all of this in one go, stores each item in the right category, sets up expiry reminders, and confirms: "All saved. I've set a reminder for 90 days before your passport expires. Anything else you want me to know?"

After that — just use Alex. The learning happens in the background.

---

## Data Lifecycle

### Updating
- Max says "My new car reg is CD21 ABC" → Alex updates, logs the change, keeps old value in history
- Max says "Actually, Arnav is on Tutorii now, not Jobpeak" → Alex updates team mapping

### Correcting
- Max says "That's wrong — my passport expires in 2029, not 2028" → Alex corrects, adjusts reminders
- If Alex suggests something based on wrong learning: "No, I don't like window seats actually" → Alex corrects preference immediately

### Forgetting
- Max says "Forget my old alarm code" → Alex deletes the entry
- Max says "Stop tracking my restaurant preferences" → Alex stops learning in that category
- Max can always ask: "What have you learned about me?" → Alex provides a structured summary

### Privacy
- Alex never shares learned information with third parties
- Learned data is subject to the same registered-number access control as everything else
- Alex never uses learned data to make assumptions about sensitive topics (health, finances, legal)
- If Max asks "What do you know about me?", Alex provides a full, honest summary — no hidden data

---

## End of Learning & Memory Engine
