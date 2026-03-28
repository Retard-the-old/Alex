const db = require('../db/pool');
const logger = require('../utils/logger');

/**
 * CONTEXT ASSEMBLER
 * The most important module in the system.
 * Queries the database and assembles context for each Claude API call type.
 */

// ─── Intent Classification Context ─────────────────────────────────────────

async function forClassification(senderNumber) {
  const [recentMessages, activeTasks, activeThreads] = await Promise.all([
    db.queryAll(`
      SELECT content, created_at FROM messages
      WHERE sender = $1 AND direction = 'inbound'
      ORDER BY created_at DESC LIMIT 5
    `, [senderNumber]),

    db.queryAll(`
      SELECT type, target, status, description FROM tasks
      WHERE status NOT IN ('completed', 'cancelled')
      ORDER BY created_at DESC LIMIT 10
    `),

    db.queryAll(`
      SELECT ct.id, ct.status, c.name as contact_name
      FROM conversation_threads ct
      JOIN contacts c ON c.id = ct.contact_id
      WHERE ct.status NOT IN ('completed', 'cancelled')
      ORDER BY ct.updated_at DESC LIMIT 10
    `),
  ]);

  let context = '';

  if (recentMessages.length > 0) {
    context += 'RECENT MESSAGES FROM MAX:\n';
    for (const m of recentMessages) {
      const time = new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      context += `- "${m.content.substring(0, 200)}" (${time})\n`;
    }
    context += '\n';
  }

  if (activeTasks.length > 0) {
    context += 'ACTIVE TASKS:\n';
    for (const t of activeTasks) {
      context += `- [${t.type}: ${t.target || 'N/A'}, status: ${t.status}]\n`;
    }
    context += '\n';
  }

  if (activeThreads.length > 0) {
    context += 'ACTIVE CONVERSATION THREADS:\n';
    for (const t of activeThreads) {
      context += `- [${t.contact_name}: ${t.status}]\n`;
    }
  }

  return context;
}

// ─── Task Execution Context ─────────────────────────────────────────────────

async function forTaskExecution(contactName) {
  const [
    maxProfile,
    contact,
    draftPrefs,
    calendar,
    travelBookings,
  ] = await Promise.all([
    getMaxProfile(),

    db.queryOne(`
      SELECT * FROM contacts WHERE LOWER(name) = LOWER($1)
    `, [contactName]),

    db.queryAll(`
      SELECT key, value FROM learned_preferences
      WHERE category IN ('communication', 'scheduling')
      AND confidence IN ('confirmed', 'high')
      ORDER BY last_confirmed DESC LIMIT 10
    `),

    // Today's calendar (placeholder — replace with Google Calendar API call)
    Promise.resolve([]),

    db.queryAll(`
      SELECT * FROM travel_bookings
      WHERE status = 'confirmed'
      AND departure_datetime > NOW()
      AND departure_datetime < NOW() + INTERVAL '7 days'
    `),
  ]);

  let context = '';

  // Max's profile
  context += `MAX'S PROFILE:\n${formatProfile(maxProfile)}\n\n`;

  // Contact record
  if (contact) {
    const prevThreads = await db.queryAll(`
      SELECT ct.summary, ct.completed_at, ct.status
      FROM conversation_threads ct
      WHERE ct.contact_id = $1
      ORDER BY ct.created_at DESC LIMIT 3
    `, [contact.id]);

    context += `CONTACT RECORD:\n`;
    context += `Name: ${contact.name}\n`;
    context += `Type: ${contact.type}\n`;
    context += `WhatsApp: ${contact.whatsapp || 'unknown'}\n`;
    context += `Knows Alex: ${contact.knows_alex}\n`;
    context += `Preferred channel: ${contact.preferred_channel}\n`;
    if (contact.communication_style) context += `Style: ${contact.communication_style}\n`;
    if (contact.reliability_score) context += `Reliability: ${contact.reliability_score}\n`;

    if (prevThreads.length > 0) {
      context += `Previous interactions:\n`;
      for (const t of prevThreads) {
        context += `- ${t.summary || 'No summary'} (${t.status})\n`;
      }
    }
    context += '\n';
  } else {
    context += `CONTACT RECORD: No existing record for "${contactName}". This is a new contact.\n\n`;
  }

  // Draft preferences
  if (draftPrefs.length > 0) {
    context += 'DRAFT STYLE NOTES:\n';
    for (const p of draftPrefs) {
      context += `- ${p.key}: ${p.value}\n`;
    }
    context += '\n';
  }

  // Active travel (location context)
  if (travelBookings.length > 0) {
    context += 'ACTIVE TRAVEL:\n';
    for (const b of travelBookings) {
      context += `- ${b.booking_type}: ${b.route || b.hotel_name}, ${b.departure_datetime || b.check_in}\n`;
    }
    context += '\n';
  }

  return { context, contact };
}

// ─── Conversation Continuation Context ──────────────────────────────────────

async function forConversationContinuation(threadId) {
  const [thread, messages, task, autonomyData] = await Promise.all([
    db.queryOne(`
      SELECT ct.*, c.name as contact_name, c.knows_alex, c.reliability_score,
             c.communication_style
      FROM conversation_threads ct
      JOIN contacts c ON c.id = ct.contact_id
      WHERE ct.id = $1
    `, [threadId]),

    db.queryAll(`
      SELECT sender, content, direction, created_at FROM messages
      WHERE thread_id = $1
      ORDER BY created_at ASC
    `, [threadId]),

    db.queryOne(`
      SELECT * FROM tasks WHERE id = (
        SELECT task_id FROM conversation_threads WHERE id = $1
      )
    `, [threadId]),

    db.queryAll(`
      SELECT action_type, was_autonomous, max_approved, max_modified
      FROM autonomy_ledger
      ORDER BY created_at DESC LIMIT 20
    `),
  ]);

  if (!thread) return null;

  let context = '';

  // Original task
  if (task) {
    context += `ORIGINAL TASK:\nType: ${task.type}\nMax's instruction: "${task.description}"\n\n`;
  }

  // Conversation history
  context += 'CONVERSATION THREAD:\n';
  for (const m of messages) {
    const label = m.direction === 'outbound' ? 'Alex' : thread.contact_name;
    context += `[${label}]: "${m.content}"\n`;
  }
  context += '\n';

  // Thread state
  context += `CURRENT STATE:\n`;
  context += `Disclosure level: ${thread.disclosure_level} (${['', 'blind', 'name only', 'full disclosure'][thread.disclosure_level]})\n`;
  context += `Thread status: ${thread.status}\n`;
  context += `Contact: ${thread.contact_name} | knows_alex: ${thread.knows_alex}\n`;
  if (thread.reliability_score) context += `Reliability: ${thread.reliability_score}\n`;
  context += '\n';

  // Autonomy data
  const autonomous = autonomyData.filter(a => a.was_autonomous).length;
  const escalated = autonomyData.filter(a => !a.was_autonomous).length;
  const approved = autonomyData.filter(a => a.max_approved && !a.max_modified).length;
  context += `AUTONOMY DATA:\n`;
  context += `Recent actions: ${autonomous} autonomous, ${escalated} escalated\n`;
  context += `Of escalated: ${approved} approved without changes\n\n`;

  // Current time for time-aware escalation
  const now = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dubai' });
  context += `CURRENT TIME: ${now} GST\n`;

  return { context, thread };
}

// ─── Daily Briefing Context ─────────────────────────────────────────────────

async function forDailyBriefing() {
  const [
    pendingEscalations,
    overdueDeliverables,
    stalledThreads,
    projectNodes,
    recentUpdates,
    activeTasks,
    openThreads,
    pendingPromises,
    keyDates,
    travelBookings,
  ] = await Promise.all([
    db.queryAll(`
      SELECT ct.id, c.name, ct.summary, ct.escalation_sent_at
      FROM conversation_threads ct
      JOIN contacts c ON c.id = ct.contact_id
      WHERE ct.escalation_status = 'pending_approval'
    `),

    db.queryAll(`
      SELECT pd.title, pd.assigned_to, pd.due_date, pn.project, pn.path
      FROM project_deliverables pd
      JOIN project_nodes pn ON pn.id = pd.node_id
      WHERE pd.status = 'overdue'
         OR (pd.due_date <= NOW() + INTERVAL '48 hours' AND pd.status NOT IN ('completed'))
    `),

    db.queryAll(`
      SELECT ct.id, c.name, ct.stalled_at
      FROM conversation_threads ct
      JOIN contacts c ON c.id = ct.contact_id
      WHERE ct.status = 'stalled'
    `),

    db.queryAll(`
      SELECT pn.id, pn.project, pn.path, pn.title, pn.node_type, pn.status,
             pn.assigned_to, pn.current_focus, pn.last_activity,
             pn.stale_threshold_days
      FROM project_nodes pn
      ORDER BY pn.project, pn.path
    `),

    db.queryAll(`
      SELECT pu.content, pu.source_person, pu.source, pu.created_at, pn.project, pn.path
      FROM project_updates pu
      JOIN project_nodes pn ON pn.id = pu.node_id
      WHERE pu.created_at > NOW() - INTERVAL '24 hours'
      ORDER BY pu.created_at DESC
    `),

    db.queryAll(`
      SELECT type, description, target, status FROM tasks
      WHERE status NOT IN ('completed', 'cancelled')
      AND target IS NULL
    `),

    db.queryAll(`
      SELECT ct.status, c.name, ct.follow_ups_sent
      FROM conversation_threads ct
      JOIN contacts c ON c.id = ct.contact_id
      WHERE ct.status IN ('awaiting_reply', 'in_progress')
    `),

    db.queryAll(`
      SELECT person, promise, deadline, status, project FROM promises
      WHERE status = 'pending'
    `),

    db.queryAll(`
      SELECT key, value, expiry_date FROM knowledge_store
      WHERE category = 'key_dates'
      AND expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
    `),

    db.queryAll(`
      SELECT * FROM travel_bookings
      WHERE status = 'confirmed'
      AND departure_datetime BETWEEN NOW() AND NOW() + INTERVAL '7 days'
    `),
  ]);

  let context = '';

  // Needs input
  if (pendingEscalations.length > 0) {
    context += '⚠️ NEEDS YOUR INPUT:\n';
    for (const e of pendingEscalations) {
      context += `- ${e.name}: ${e.summary || 'escalation pending'} (since ${new Date(e.escalation_sent_at).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })})\n`;
    }
    context += '\n';
  }

  // Overdue
  if (overdueDeliverables.length > 0 || stalledThreads.length > 0) {
    context += '🚨 OVERDUE / AT RISK:\n';
    for (const d of overdueDeliverables) {
      context += `- ${d.assigned_to || 'Unassigned'}: ${d.title} (due ${d.due_date}) — ${d.path}\n`;
    }
    for (const s of stalledThreads) {
      context += `- ${s.name}: conversation stalled since ${new Date(s.stalled_at).toLocaleDateString('en-GB')}\n`;
    }
    context += '\n';
  }

  // Business status — group by project
  context += '📊 BUSINESS STATUS:\n\n';
  const projects = {};
  for (const node of projectNodes) {
    if (!projects[node.project]) projects[node.project] = [];
    projects[node.project].push(node);
  }

  for (const [projectKey, nodes] of Object.entries(projects)) {
    const root = nodes.find(n => n.node_type === 'project');
    context += `${(root?.title || projectKey).toUpperCase()}:\n`;

    for (const node of nodes) {
      if (node.node_type === 'project' || node.node_type === 'department') continue;
      if (!node.assigned_to || node.assigned_to.length === 0) continue;

      const people = node.assigned_to.join(', ');
      let status = '';

      if (node.status === 'blocked') status = '🔴 BLOCKED';
      else if (node.status === 'paused') status = '⏸ Paused';
      else if (!node.last_activity) status = '⚪ No activity recorded';
      else {
        const daysSince = Math.floor((Date.now() - new Date(node.last_activity).getTime()) / 86400000);
        if (daysSince > node.stale_threshold_days) {
          status = `🟡 No updates in ${daysSince} days`;
        } else {
          status = `🟢 Active (${daysSince}d ago)`;
        }
      }

      context += `- ${people} (${node.title}): ${status}`;
      if (node.current_focus) context += ` — ${node.current_focus}`;
      context += '\n';
    }
    context += '\n';
  }

  // Max's tasks
  if (activeTasks.length > 0) {
    context += '📋 YOUR TASKS:\n';
    for (const t of activeTasks) {
      context += `- ${t.description}\n`;
    }
    context += '\n';
  }

  // Open outreach
  if (openThreads.length > 0) {
    context += '📬 OPEN OUTREACH:\n';
    for (const t of openThreads) {
      context += `- ${t.name}: ${t.status} (follow-ups: ${t.follow_ups_sent})\n`;
    }
    context += '\n';
  }

  // Upcoming travel
  if (travelBookings.length > 0) {
    context += '✈️ UPCOMING TRAVEL:\n';
    for (const b of travelBookings) {
      context += `- ${b.booking_type}: ${b.route || b.hotel_name}, ${b.departure_datetime || b.check_in}\n`;
    }
    context += '\n';
  }

  // Key dates
  if (keyDates.length > 0) {
    context += '📌 KEY DATES:\n';
    for (const k of keyDates) {
      const daysUntil = Math.ceil((new Date(k.expiry_date) - Date.now()) / 86400000);
      context += `- ${k.key}: ${k.value} — ${k.expiry_date} (${daysUntil} days)\n`;
    }
    context += '\n';
  }

  // Pending promises
  if (pendingPromises.length > 0) {
    context += '🤝 PENDING PROMISES:\n';
    for (const p of pendingPromises) {
      context += `- ${p.person}: "${p.promise}" (${p.project || 'general'})`;
      if (p.deadline) context += ` — deadline: ${p.deadline}`;
      context += '\n';
    }
    context += '\n';
  }

  // Since last briefing
  if (recentUpdates.length > 0) {
    context += '🔄 SINCE LAST BRIEFING:\n';
    for (const u of recentUpdates) {
      const time = new Date(u.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit' });
      context += `- ${u.source_person || u.source}: ${u.content.substring(0, 100)} (${time})\n`;
    }
  }

  return context;
}

// ─── Project Intelligence Context ───────────────────────────────────────────

async function forProjectQuery(queryText) {
  // Determine if this is a person query or project query
  const lowerQuery = queryText.toLowerCase();

  // Check if a person is mentioned
  const monitoredContacts = await db.queryAll(`
    SELECT name FROM contacts WHERE is_monitored = true
  `);
  const mentionedPerson = monitoredContacts.find(c =>
    lowerQuery.includes(c.name.toLowerCase())
  );

  let context = '';

  if (mentionedPerson) {
    // Person-focused query
    const [nodes, updates, deliverables, promises, contact] = await Promise.all([
      db.queryAll(`
        SELECT * FROM project_nodes WHERE $1 = ANY(assigned_to)
      `, [mentionedPerson.name]),

      db.queryAll(`
        SELECT pu.*, pn.path FROM project_updates pu
        JOIN project_nodes pn ON pn.id = pu.node_id
        WHERE pu.source_person = $1
        ORDER BY pu.created_at DESC LIMIT 10
      `, [mentionedPerson.name]),

      db.queryAll(`
        SELECT pd.*, pn.path FROM project_deliverables pd
        JOIN project_nodes pn ON pn.id = pd.node_id
        WHERE pd.assigned_to = $1
        AND pd.status NOT IN ('completed')
      `, [mentionedPerson.name]),

      db.queryAll(`
        SELECT * FROM promises WHERE person = $1 AND status = 'pending'
      `, [mentionedPerson.name]),

      db.queryOne(`
        SELECT * FROM contacts WHERE name = $1
      `, [mentionedPerson.name]),
    ]);

    context += `PERSON QUERY: ${mentionedPerson.name}\n\n`;

    context += 'PROJECT NODES ASSIGNED:\n';
    for (const n of nodes) {
      context += `- ${n.path} (status: ${n.status})`;
      if (n.current_focus) context += ` — focus: ${n.current_focus}`;
      context += '\n';
    }
    context += '\n';

    if (updates.length > 0) {
      context += 'RECENT UPDATES:\n';
      for (const u of updates) {
        const date = new Date(u.created_at).toLocaleDateString('en-GB');
        context += `- ${date}: "${u.content.substring(0, 150)}" (${u.source})\n`;
      }
      context += '\n';
    }

    if (deliverables.length > 0) {
      context += 'ACTIVE DELIVERABLES:\n';
      for (const d of deliverables) {
        context += `- ${d.title} — status: ${d.status}`;
        if (d.due_date) context += `, due: ${d.due_date}`;
        context += '\n';
      }
      context += '\n';
    }

    if (promises.length > 0) {
      context += 'PENDING PROMISES:\n';
      for (const p of promises) {
        context += `- "${p.promise}"`;
        if (p.deadline) context += ` — deadline: ${p.deadline}`;
        context += '\n';
      }
      context += '\n';
    }

    if (contact) {
      context += `CONTACT RECORD:\n`;
      context += `reliability_score: ${contact.reliability_score || 'N/A'}\n`;
      context += `typical_response_time: ${contact.typical_response_time || 'N/A'}\n`;
      context += `last_interaction: ${contact.last_interaction || 'N/A'}\n`;
    }

    // Dependencies blocked by this person
    const blocking = await db.queryAll(`
      SELECT pd.description, blocked.title as blocked_title, blocked.assigned_to
      FROM project_dependencies pd
      JOIN project_nodes blocking ON blocking.id = pd.blocking_node_id
      JOIN project_nodes blocked ON blocked.id = pd.blocked_node_id
      WHERE $1 = ANY(blocking.assigned_to)
      AND pd.status = 'active'
    `, [mentionedPerson.name]);

    if (blocking.length > 0) {
      context += '\nDEPENDENCIES BLOCKED BY THIS PERSON:\n';
      for (const b of blocking) {
        context += `- ${b.blocked_title} (${b.blocked_assigned_to?.join(', ')}): ${b.description}\n`;
      }
    }

  } else {
    // Project-focused query — find which project
    const allProjects = await db.queryAll(`
      SELECT DISTINCT project FROM project_nodes
    `);
    const matchedProject = allProjects.find(p =>
      lowerQuery.includes(p.project.replace(/_/g, ' '))
    );

    const projectFilter = matchedProject ? matchedProject.project : null;

    const nodes = await db.queryAll(`
      SELECT * FROM project_nodes
      ${projectFilter ? 'WHERE project = $1' : ''}
      ORDER BY project, path
    `, projectFilter ? [projectFilter] : []);

    context += `PROJECT QUERY${projectFilter ? `: ${projectFilter}` : ': all projects'}\n\n`;

    for (const node of nodes) {
      if (node.node_type === 'project') {
        context += `\n${node.title.toUpperCase()}\n`;
        continue;
      }

      const updates = await db.queryAll(`
        SELECT content, source_person, created_at FROM project_updates
        WHERE node_id = $1
        ORDER BY created_at DESC LIMIT 3
      `, [node.id]);

      context += `- ${node.path} [${node.status}]`;
      if (node.assigned_to?.length) context += ` (${node.assigned_to.join(', ')})`;
      context += '\n';

      for (const u of updates) {
        const date = new Date(u.created_at).toLocaleDateString('en-GB');
        context += `  └ ${date}: ${u.content.substring(0, 100)}\n`;
      }
    }
  }

  return context;
}

// ─── Travel Search Context ──────────────────────────────────────────────────

async function forTravelSearch() {
  const [profile, prefs, routeHistory] = await Promise.all([
    getMaxProfile(),

    db.queryAll(`
      SELECT key, value FROM learned_preferences
      WHERE category = 'travel' AND confidence IN ('confirmed', 'high')
    `),

    db.queryAll(`
      SELECT route, airline, cabin_class, ticket_price, departure_datetime
      FROM travel_bookings
      ORDER BY created_at DESC LIMIT 10
    `),
  ]);

  let context = `MAX'S PROFILE:\n${formatProfile(profile)}\n\n`;

  if (prefs.length > 0) {
    context += 'TRAVEL PREFERENCES:\n';
    for (const p of prefs) {
      context += `- ${p.key}: ${p.value}\n`;
    }
    context += '\n';
  }

  if (routeHistory.length > 0) {
    context += 'ROUTE HISTORY:\n';
    for (const b of routeHistory) {
      context += `- ${b.route}: ${b.airline}, ${b.cabin_class}, £${b.ticket_price} (${new Date(b.departure_datetime).toLocaleDateString('en-GB')})\n`;
    }
  }

  return context;
}

// ─── Monitoring Extraction Context ──────────────────────────────────────────

async function forMonitoringExtraction(senderName) {
  const [contact, nodes, recentUpdates] = await Promise.all([
    db.queryOne(`SELECT * FROM contacts WHERE LOWER(name) = LOWER($1)`, [senderName]),

    db.queryAll(`
      SELECT id, project, path, title, current_focus FROM project_nodes
      WHERE $1 = ANY(assigned_to)
    `, [senderName]),

    db.queryAll(`
      SELECT content, created_at FROM project_updates
      WHERE source_person = $1
      ORDER BY created_at DESC LIMIT 5
    `, [senderName]),
  ]);

  let context = `SENDER: ${senderName}\n`;
  if (contact) {
    context += `Role: ${contact.role}\nProjects: ${contact.projects?.join(', ')}\n\n`;
  }

  if (nodes.length > 0) {
    context += 'ASSIGNED PROJECT NODES:\n';
    for (const n of nodes) {
      context += `- ${n.path}`;
      if (n.current_focus) context += ` (focus: ${n.current_focus})`;
      context += '\n';
    }
    context += '\n';
  }

  if (recentUpdates.length > 0) {
    context += 'RECENT UPDATES FROM THIS PERSON:\n';
    for (const u of recentUpdates) {
      const date = new Date(u.created_at).toLocaleDateString('en-GB');
      context += `- ${date}: ${u.content.substring(0, 150)}\n`;
    }
  }

  return context;
}

// ─── Learning Extraction Context ────────────────────────────────────────────

async function forLearningExtraction() {
  const prefs = await db.queryAll(`
    SELECT category, key, value FROM learned_preferences
    ORDER BY updated_at DESC LIMIT 30
  `);

  let context = 'EXISTING PREFERENCES:\n';
  for (const p of prefs) {
    context += `- ${p.category}.${p.key}: ${p.value}\n`;
  }
  return context;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getMaxProfile() {
  return db.queryAll(`
    SELECT category, key, value, is_sensitive FROM knowledge_store
    WHERE category IN ('personal', 'preferences', 'loyalty')
    ORDER BY category, key
  `);
}

function formatProfile(rows) {
  if (!rows || rows.length === 0) return 'No profile data stored yet.';
  return rows.map(r => {
    const val = r.is_sensitive ? `****${r.value.slice(-4)}` : r.value;
    return `${r.key}: ${val}`;
  }).join('\n');
}

module.exports = {
  forClassification,
  forTaskExecution,
  forConversationContinuation,
  forDailyBriefing,
  forProjectQuery,
  forTravelSearch,
  forMonitoringExtraction,
  forLearningExtraction,
};
