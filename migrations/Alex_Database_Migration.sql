-- ============================================================================
-- ALEX — Complete Database Migration + Seed Data
-- Run this file once to create all tables, indexes, and initial data.
-- PostgreSQL 14+
-- ============================================================================


-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. KNOWLEDGE STORE
CREATE TABLE knowledge_store (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  key VARCHAR(200) NOT NULL,
  value TEXT NOT NULL,
  is_sensitive BOOLEAN DEFAULT false,
  expiry_date DATE,
  reminder_days_before INTEGER,
  source VARCHAR(50),
  confidence VARCHAR(20) DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(category, key)
);

CREATE INDEX idx_knowledge_category ON knowledge_store(category);
CREATE INDEX idx_knowledge_expiry ON knowledge_store(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX idx_knowledge_sensitive ON knowledge_store(is_sensitive) WHERE is_sensitive = true;

-- 2. CONTACTS
CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL,
  relationship VARCHAR(100),
  company VARCHAR(200),
  role VARCHAR(200),
  projects TEXT[],
  whatsapp VARCHAR(50),
  email VARCHAR(200),
  phone VARCHAR(50),
  website VARCHAR(500),
  address TEXT,
  preferred_channel VARCHAR(20) DEFAULT 'whatsapp',
  knows_alex BOOLEAN DEFAULT false,
  is_monitored BOOLEAN DEFAULT false,
  discovery_source VARCHAR(50),
  communication_style VARCHAR(100),
  typical_response_time VARCHAR(50),
  reliability_score DECIMAL(3,2),
  context_notes TEXT[],
  last_interaction TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_contacts_name ON contacts(name);
CREATE INDEX idx_contacts_type ON contacts(type);
CREATE INDEX idx_contacts_whatsapp ON contacts(whatsapp) WHERE whatsapp IS NOT NULL;
CREATE INDEX idx_contacts_email ON contacts(email) WHERE email IS NOT NULL;
CREATE INDEX idx_contacts_monitored ON contacts(is_monitored) WHERE is_monitored = true;
CREATE INDEX idx_contacts_projects ON contacts USING GIN(projects);

-- 3. CONVERSATION THREADS
CREATE TABLE conversation_threads (
  id SERIAL PRIMARY KEY,
  contact_id INTEGER REFERENCES contacts(id),
  task_id INTEGER,
  channel VARCHAR(20) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'initiated',
  disclosure_level INTEGER DEFAULT 1,
  escalation_status VARCHAR(30),
  escalation_sent_at TIMESTAMP,
  follow_ups_sent INTEGER DEFAULT 0,
  last_follow_up_at TIMESTAMP,
  stalled_at TIMESTAMP,
  completed_at TIMESTAMP,
  summary TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_threads_status ON conversation_threads(status);
CREATE INDEX idx_threads_contact ON conversation_threads(contact_id);
CREATE INDEX idx_threads_escalation ON conversation_threads(escalation_status) WHERE escalation_status IS NOT NULL;

-- 4. MESSAGES
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  thread_id INTEGER REFERENCES conversation_threads(id),
  direction VARCHAR(10) NOT NULL,
  sender VARCHAR(100) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text',
  attachment_url TEXT,
  whatsapp_message_id VARCHAR(100),
  delivered BOOLEAN,
  read BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_messages_created ON messages(created_at);

-- 5. TASKS
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  priority VARCHAR(20) DEFAULT 'normal',
  target VARCHAR(200),
  channel VARCHAR(20),
  parent_task_id INTEGER REFERENCES tasks(id),
  project VARCHAR(100),
  outcome TEXT,
  outcome_data JSONB,
  calendar_event_id VARCHAR(200),
  booking_reference VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_type ON tasks(type);
CREATE INDEX idx_tasks_project ON tasks(project) WHERE project IS NOT NULL;

ALTER TABLE conversation_threads
  ADD CONSTRAINT fk_thread_task FOREIGN KEY (task_id) REFERENCES tasks(id);

-- 6. REMINDERS
CREATE TABLE reminders (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  reminder_type VARCHAR(20) NOT NULL,
  next_fire TIMESTAMP NOT NULL,
  recurrence_rule VARCHAR(100),
  relative_to VARCHAR(200),
  relative_days_before INTEGER,
  status VARCHAR(20) DEFAULT 'active',
  linked_knowledge_id INTEGER REFERENCES knowledge_store(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reminders_fire ON reminders(next_fire) WHERE status = 'active';

-- 7. AUDIT LOG
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  requesting_number VARCHAR(50),
  target VARCHAR(500),
  outcome VARCHAR(50) NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- 8. PROJECT NODES
CREATE TABLE project_nodes (
  id SERIAL PRIMARY KEY,
  parent_id INTEGER REFERENCES project_nodes(id),
  project VARCHAR(100) NOT NULL,
  path TEXT NOT NULL,
  title VARCHAR(200) NOT NULL,
  node_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  priority VARCHAR(20) DEFAULT 'normal',
  assigned_to TEXT[],
  description TEXT,
  current_focus TEXT,
  last_activity TIMESTAMP,
  last_activity_source VARCHAR(50),
  stale_threshold_days INTEGER DEFAULT 14,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_nodes_project ON project_nodes(project);
CREATE INDEX idx_nodes_status ON project_nodes(status);
CREATE INDEX idx_nodes_parent ON project_nodes(parent_id);
CREATE INDEX idx_nodes_assigned ON project_nodes USING GIN(assigned_to);
CREATE INDEX idx_nodes_path ON project_nodes(path);
CREATE INDEX idx_nodes_last_activity ON project_nodes(last_activity);

-- 9. PROJECT UPDATES
CREATE TABLE project_updates (
  id SERIAL PRIMARY KEY,
  node_id INTEGER REFERENCES project_nodes(id),
  update_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  source VARCHAR(50) NOT NULL,
  source_person VARCHAR(100),
  confidence VARCHAR(20) DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_updates_node ON project_updates(node_id);
CREATE INDEX idx_updates_created ON project_updates(created_at);

-- 10. PROJECT DELIVERABLES
CREATE TABLE project_deliverables (
  id SERIAL PRIMARY KEY,
  node_id INTEGER REFERENCES project_nodes(id),
  title VARCHAR(200) NOT NULL,
  assigned_to VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  due_date DATE,
  completed_date DATE,
  description TEXT,
  source VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deliverables_node ON project_deliverables(node_id);
CREATE INDEX idx_deliverables_status ON project_deliverables(status);
CREATE INDEX idx_deliverables_due ON project_deliverables(due_date) WHERE due_date IS NOT NULL;

-- 11. PROJECT DEPENDENCIES
CREATE TABLE project_dependencies (
  id SERIAL PRIMARY KEY,
  blocking_node_id INTEGER REFERENCES project_nodes(id),
  blocked_node_id INTEGER REFERENCES project_nodes(id),
  dependency_type VARCHAR(50) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  discovered_via VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deps_blocking ON project_dependencies(blocking_node_id);
CREATE INDEX idx_deps_blocked ON project_dependencies(blocked_node_id);

-- 12. LEARNED PREFERENCES
CREATE TABLE learned_preferences (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  key VARCHAR(200) NOT NULL,
  value TEXT NOT NULL,
  confidence VARCHAR(20) DEFAULT 'medium',
  evidence_count INTEGER DEFAULT 1,
  last_confirmed TIMESTAMP,
  last_applied TIMESTAMP,
  decay_after_days INTEGER DEFAULT 180,
  source VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(category, key)
);

CREATE INDEX idx_prefs_category ON learned_preferences(category);
CREATE INDEX idx_prefs_confidence ON learned_preferences(confidence);

-- 13. CLASSIFICATION LOG
CREATE TABLE classification_log (
  id SERIAL PRIMARY KEY,
  message_hash VARCHAR(64),
  channel VARCHAR(20) NOT NULL,
  sender VARCHAR(100) NOT NULL,
  message_preview VARCHAR(500),
  classified_intent VARCHAR(50) NOT NULL,
  secondary_intent VARCHAR(50),
  confidence DECIMAL(3,2) NOT NULL,
  handler VARCHAR(50) NOT NULL,
  urgency_level VARCHAR(20),
  was_correct BOOLEAN,
  correction_intent VARCHAR(50),
  processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_class_intent ON classification_log(classified_intent);
CREATE INDEX idx_class_created ON classification_log(created_at);
CREATE INDEX idx_class_correct ON classification_log(was_correct) WHERE was_correct = false;

-- 14. AUTONOMY LEDGER
CREATE TABLE autonomy_ledger (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(100) NOT NULL,
  was_autonomous BOOLEAN NOT NULL,
  max_approved BOOLEAN,
  max_modified BOOLEAN DEFAULT false,
  modification_details TEXT,
  context TEXT,
  thread_id INTEGER REFERENCES conversation_threads(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_autonomy_action ON autonomy_ledger(action_type);
CREATE INDEX idx_autonomy_modified ON autonomy_ledger(max_modified) WHERE max_modified = true;

-- 15. DRAFT CONVERGENCE LOG
CREATE TABLE draft_convergence (
  id SERIAL PRIMARY KEY,
  original_draft TEXT NOT NULL,
  max_modified_to TEXT NOT NULL,
  changes_detected JSONB,
  context_type VARCHAR(50),
  channel VARCHAR(20),
  recipient_type VARCHAR(50),
  thread_id INTEGER REFERENCES conversation_threads(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_drafts_context ON draft_convergence(context_type);

-- 16. PROMISES
CREATE TABLE promises (
  id SERIAL PRIMARY KEY,
  person VARCHAR(100) NOT NULL,
  promise TEXT NOT NULL,
  source VARCHAR(50) NOT NULL,
  project VARCHAR(100),
  node_id INTEGER REFERENCES project_nodes(id),
  deadline DATE,
  status VARCHAR(30) DEFAULT 'pending',
  follow_up_count INTEGER DEFAULT 0,
  last_checked TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_promises_person ON promises(person);
CREATE INDEX idx_promises_status ON promises(status);
CREATE INDEX idx_promises_deadline ON promises(deadline) WHERE deadline IS NOT NULL;

-- 17. TRAVEL BOOKINGS
CREATE TABLE travel_bookings (
  id SERIAL PRIMARY KEY,
  booking_type VARCHAR(20) NOT NULL,
  duffel_order_id VARCHAR(100),
  booking_reference VARCHAR(100),
  status VARCHAR(30) DEFAULT 'confirmed',
  route VARCHAR(100),
  airline VARCHAR(100),
  flight_number VARCHAR(20),
  hotel_name VARCHAR(200),
  departure_datetime TIMESTAMP,
  arrival_datetime TIMESTAMP,
  check_in DATE,
  check_out DATE,
  cabin_class VARCHAR(20),
  ticket_price DECIMAL(10,2),
  total_charged DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'GBP',
  card_last_four VARCHAR(4),
  loyalty_number_applied VARCHAR(50),
  calendar_event_id VARCHAR(200),
  task_id INTEGER REFERENCES tasks(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bookings_type ON travel_bookings(booking_type);
CREATE INDEX idx_bookings_status ON travel_bookings(status);
CREATE INDEX idx_bookings_route ON travel_bookings(route);

-- 18. PRICE WATCHES
CREATE TABLE price_watches (
  id SERIAL PRIMARY KEY,
  watch_type VARCHAR(20) NOT NULL,
  search_params JSONB NOT NULL,
  target_price DECIMAL(10,2),
  last_price DECIMAL(10,2),
  last_checked TIMESTAMP,
  price_history JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'active',
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_watches_status ON price_watches(status) WHERE status = 'active';


-- ============================================================================
-- SEED DATA: PROJECT GRAPH
-- Source: Max's business structure (My_Businesses_2.pdf)
-- ============================================================================

-- CHICKERELL
INSERT INTO project_nodes (id, parent_id, project, path, title, node_type, assigned_to, stale_threshold_days) VALUES
  (1,  NULL, 'chickerell',       'Chickerell',                        'Chickerell',    'project',    NULL,                 14),
  (2,  1,    'chickerell',       'Chickerell > Accounting',           'Accounting',    'department', '{Adel}',             14),
  (3,  1,    'chickerell',       'Chickerell > Legal',                'Legal',         'department', '{Susan,Jane}',       14),
  (4,  1,    'chickerell',       'Chickerell > Planning',             'Planning',      'department', '{Corylus}',          14);

-- JOBPEAK.NET
INSERT INTO project_nodes (id, parent_id, project, path, title, node_type, assigned_to, stale_threshold_days) VALUES
  (10, NULL, 'jobpeak',          'Jobpeak',                                                         'Jobpeak.net',                         'project',     NULL,            14),
  (11, 10,   'jobpeak',          'Jobpeak > Marketing',                                             'Marketing',                           'department',  NULL,            14),
  (12, 11,   'jobpeak',          'Jobpeak > Marketing > Bombay Media',                              'Bombay Media',                        'workstream',  '{Farhan}',      7),
  (13, 11,   'jobpeak',          'Jobpeak > Marketing > AI Agent',                                  'Marketing AI Agent',                  'workstream',  NULL,            14),
  (14, 11,   'jobpeak',          'Jobpeak > Marketing > Paid Ads & Funnel Building',                'Paid Ads & Funnel Building',          'workstream',  NULL,            14),
  (15, 14,   'jobpeak',          'Jobpeak > Marketing > Paid Ads & Funnel Building > Google',       'Google Ads',                          'workstream',  NULL,            14),
  (16, 14,   'jobpeak',          'Jobpeak > Marketing > Paid Ads & Funnel Building > Meta',         'Meta Ads',                            'workstream',  NULL,            14),
  (17, 11,   'jobpeak',          'Jobpeak > Marketing > SEO/GEO',                                   'SEO/GEO Optimisation',                'workstream',  NULL,            14),
  (18, 11,   'jobpeak',          'Jobpeak > Marketing > Email/WA/Outreach',                         'Email/WA/Outreach Marketing',         'workstream',  NULL,            14),
  (19, 18,   'jobpeak',          'Jobpeak > Marketing > Email/WA/Outreach > Lead Gen',              'Lead Gen Databases (Joz)',            'workstream',  '{Joz}',         14),
  (20, 18,   'jobpeak',          'Jobpeak > Marketing > Email/WA/Outreach > Email Bot',             'Email Bot',                           'workstream',  '{Diyan}',       7),
  (21, 18,   'jobpeak',          'Jobpeak > Marketing > Email/WA/Outreach > WA Bot',                'WhatsApp Bot',                        'workstream',  '{Usman}',       7),
  (22, 11,   'jobpeak',          'Jobpeak > Marketing > Social Media',                              'Social Media',                        'workstream',  '{Arnav}',       7),
  (23, 10,   'jobpeak',          'Jobpeak > Platform Development',                                  'Platform Development',                'department',  NULL,            14),
  (24, 23,   'jobpeak',          'Jobpeak > Platform Development > CRO',                            'CRO Optimisation',                    'workstream',  '{Min Bui}',     7);

-- TUTORII.COM
INSERT INTO project_nodes (id, parent_id, project, path, title, node_type, assigned_to, stale_threshold_days) VALUES
  (30, NULL, 'tutorii',          'Tutorii',                                                         'Tutorii.com',                         'project',     NULL,            14),
  (31, 30,   'tutorii',          'Tutorii > Marketing',                                             'Marketing',                           'department',  NULL,            14),
  (32, 31,   'tutorii',          'Tutorii > Marketing > Email/WA/Outreach',                         'Email/WA/Outreach Marketing',         'workstream',  NULL,            14),
  (33, 32,   'tutorii',          'Tutorii > Marketing > Email/WA/Outreach > Lead Gen',              'Lead Gen Databases (Joz)',            'workstream',  '{Joz}',         14),
  (34, 32,   'tutorii',          'Tutorii > Marketing > Email/WA/Outreach > WA Bot',                'WhatsApp Bot',                        'workstream',  '{Usman}',       7),
  (35, 32,   'tutorii',          'Tutorii > Marketing > Email/WA/Outreach > Email Bot',             'Email Bot',                           'workstream',  '{Diyan}',       7),
  (36, 31,   'tutorii',          'Tutorii > Marketing > Social Media',                              'Social Media',                        'workstream',  NULL,            14),
  (37, 30,   'tutorii',          'Tutorii > Platform Development',                                  'Platform Development',                'department',  NULL,            14),
  (38, 37,   'tutorii',          'Tutorii > Platform Development > Epixel',                         'Epixel',                              'workstream',  '{Epixel}',      7),
  (39, 37,   'tutorii',          'Tutorii > Platform Development > UX',                             'UX Optimisation',                     'workstream',  '{Min Bui}',     7);

-- PREMIERBLUEPRINT.COM
INSERT INTO project_nodes (id, parent_id, project, path, title, node_type, assigned_to, stale_threshold_days) VALUES
  (40, NULL, 'premierblueprint', 'Premierblueprint',                                               'Premierblueprint.com',                'project',     NULL,            14),
  (41, 40,   'premierblueprint', 'Premierblueprint > Marketing',                                   'Marketing',                           'department',  NULL,            14),
  (42, 41,   'premierblueprint', 'Premierblueprint > Marketing > Email/WA/Outreach',               'Email/WA/Outreach Marketing',         'workstream',  NULL,            14),
  (43, 41,   'premierblueprint', 'Premierblueprint > Marketing > Social Media',                    'Social Media',                        'workstream',  NULL,            14),
  (44, 41,   'premierblueprint', 'Premierblueprint > Marketing > Press Releases',                  'Press Releases (PR Newswire)',         'workstream',  NULL,            14),
  (45, 40,   'premierblueprint', 'Premierblueprint > Platform Development',                        'Platform Development',                'department',  NULL,            14),
  (46, 45,   'premierblueprint', 'Premierblueprint > Platform Development > Lead Dev',             'Lead Developer',                      'workstream',  '{Teddy Gatu}',  7);

-- US REAL ESTATE AGENT PLATFORM
INSERT INTO project_nodes (id, parent_id, project, path, title, node_type, assigned_to, status, stale_threshold_days) VALUES
  (50, NULL, 'us_agent_platform', 'US Agent Platform',                                             'US Real Estate Agent Platform',       'project',     NULL,            'paused', 30),
  (51, 50,   'us_agent_platform', 'US Agent Platform > Marketing',                                 'Marketing',                           'department',  NULL,            'paused', 30),
  (52, 51,   'us_agent_platform', 'US Agent Platform > Marketing > Email Outreach',                'Email Outreach',                      'workstream',  NULL,            'paused', 30),
  (53, 52,   'us_agent_platform', 'US Agent Platform > Marketing > Email Outreach > Lead Gen',     'Lead Gen Databases (Joz)',            'workstream',  '{Joz}',         'paused', 30),
  (54, 52,   'us_agent_platform', 'US Agent Platform > Marketing > Email Outreach > Email Bot',    'Email Bot',                           'workstream',  '{Diyan}',       'paused', 30),
  (55, 52,   'us_agent_platform', 'US Agent Platform > Marketing > Email Outreach > WA Bot',       'WhatsApp Bot',                        'workstream',  '{Usman}',       'paused', 30),
  (56, 50,   'us_agent_platform', 'US Agent Platform > Platform Development',                      'Platform Development',                'department',  NULL,            'paused', 30),
  (57, 56,   'us_agent_platform', 'US Agent Platform > Platform Development > Dev',                'Lead Developer',                      'workstream',  '{Teddy Gatu}',  'paused', 30);

-- THE NAIL DXB
INSERT INTO project_nodes (id, parent_id, project, path, title, node_type, assigned_to, stale_threshold_days) VALUES
  (60, NULL, 'the_nail_dxb',     'The Nail DXB',                                                   'The Nail DXB',                        'project',     NULL,            14),
  (61, 60,   'the_nail_dxb',     'The Nail DXB > Leases',                                          'Leases',                              'department',  NULL,            30),
  (62, 61,   'the_nail_dxb',     'The Nail DXB > Leases > Shop Lease',                             'Shop Lease (Djipar Landlord)',         'workstream',  NULL,            30),
  (63, 61,   'the_nail_dxb',     'The Nail DXB > Leases > Staff Accommodation',                    'Employee Accommodation (SBK Landlord)','workstream',  NULL,            30),
  (64, 60,   'the_nail_dxb',     'The Nail DXB > Staff',                                           'Staff',                               'department',  NULL,            14),
  (65, 60,   'the_nail_dxb',     'The Nail DXB > Administrative',                                  'Administrative',                      'department',  NULL,            14),
  (66, 65,   'the_nail_dxb',     'The Nail DXB > Administrative > Hiring & Visas',                 'Hiring & Visas',                      'workstream',  '{Kathika PRO}', 14),
  (67, 65,   'the_nail_dxb',     'The Nail DXB > Administrative > Accounting',                     'Accounting',                          'workstream',  '{Kathika PRO}', 14),
  (68, 65,   'the_nail_dxb',     'The Nail DXB > Administrative > Banking',                        'Banking (Wio / ENBD)',                'workstream',  NULL,            14),
  (69, 65,   'the_nail_dxb',     'The Nail DXB > Administrative > Payment Processor',              'Payment Processor',                   'workstream',  NULL,            14),
  (70, 60,   'the_nail_dxb',     'The Nail DXB > Marketing',                                       'Marketing',                           'department',  NULL,            14),
  (71, 70,   'the_nail_dxb',     'The Nail DXB > Marketing > Instagram',                           'Instagram',                           'workstream',  NULL,            7),
  (72, 70,   'the_nail_dxb',     'The Nail DXB > Marketing > Receptionist Agent',                  'Automated Receptionist Agent',        'workstream',  '{Usman}',       7);

-- Reset sequence
SELECT setval('project_nodes_id_seq', (SELECT MAX(id) FROM project_nodes));


-- ============================================================================
-- SEED DATA: CONTACTS
-- ============================================================================

INSERT INTO contacts (name, type, relationship, company, role, projects, knows_alex, is_monitored, discovery_source) VALUES
  ('Farhan',      'team_member',  'works_for_max', 'Bombay Media',  'Creative Director',          '{jobpeak}',                                       true, true, 'max_direct'),
  ('Usman',       'team_member',  'works_for_max', NULL,            'WhatsApp Bot Developer',     '{jobpeak,tutorii,us_agent_platform,the_nail_dxb}', true, true, 'max_direct'),
  ('Diyan',       'team_member',  'works_for_max', NULL,            'Email Bot Developer',        '{jobpeak,tutorii,us_agent_platform}',              true, true, 'max_direct'),
  ('Arnav',       'team_member',  'works_for_max', NULL,            'Social Media Manager',       '{jobpeak}',                                       true, true, 'max_direct'),
  ('Min Bui',     'team_member',  'works_for_max', NULL,            'CRO / UX Optimisation',      '{jobpeak,tutorii}',                               true, true, 'max_direct'),
  ('Joz',         'team_member',  'works_for_max', 'Joz Database',  'Lead Gen Databases',         '{jobpeak,tutorii,us_agent_platform}',              true, true, 'max_direct'),
  ('Teddy Gatu',  'team_member',  'works_for_max', NULL,            'Lead Developer',             '{premierblueprint,us_agent_platform}',             true, true, 'max_direct'),
  ('Adel',        'team_member',  'works_for_max', NULL,            'Accountant',                 '{chickerell}',                                    true, true, 'max_direct'),
  ('Susan',       'team_member',  'works_for_max', NULL,            'Legal',                      '{chickerell}',                                    true, true, 'max_direct'),
  ('Jane',        'team_member',  'works_for_max', NULL,            'Legal',                      '{chickerell}',                                    true, true, 'max_direct'),
  ('Corylus',     'team_member',  'works_for_max', NULL,            'Planning Consultant',        '{chickerell}',                                    true, true, 'max_direct'),
  ('Epixel',      'team_member',  'works_for_max', 'Epixel',       'Platform Developer',         '{tutorii}',                                       true, true, 'max_direct'),
  ('Kathika PRO', 'team_member',  'works_for_max', 'Kathika PRO',  'PRO / Admin / Accounting',   '{the_nail_dxb}',                                  true, true, 'max_direct'),
  ('Djipar',      'professional', 'landlord',      NULL,            'Shop Landlord (The Nail DXB)', '{the_nail_dxb}',                                false, false, 'max_direct'),
  ('SBK',         'professional', 'landlord',      NULL,            'Staff Accommodation Landlord', '{the_nail_dxb}',                                false, false, 'max_direct');


-- ============================================================================
-- VIEWS
-- ============================================================================

CREATE VIEW monitored_contacts AS
SELECT
  c.id, c.name, c.whatsapp, c.projects, c.role,
  array_agg(DISTINCT pn.path) AS assigned_paths
FROM contacts c
LEFT JOIN project_nodes pn ON c.name = ANY(pn.assigned_to)
WHERE c.is_monitored = true
GROUP BY c.id, c.name, c.whatsapp, c.projects, c.role;

CREATE VIEW project_tree AS
SELECT
  pn.id, pn.project, pn.path, pn.title, pn.node_type, pn.status, pn.priority,
  pn.assigned_to, pn.current_focus, pn.last_activity, pn.stale_threshold_days,
  CASE
    WHEN pn.status = 'blocked' THEN '🔴'
    WHEN pn.status = 'paused' THEN '⏸'
    WHEN pn.last_activity IS NULL THEN '⚪'
    WHEN pn.last_activity < NOW() - (pn.stale_threshold_days || ' days')::INTERVAL THEN '🟡'
    ELSE '🟢'
  END AS status_indicator,
  (SELECT COUNT(*) FROM project_deliverables pd WHERE pd.node_id = pn.id AND pd.status = 'overdue') AS overdue_deliverables
FROM project_nodes pn
ORDER BY pn.project, pn.path;


-- ============================================================================
-- MIGRATION COMPLETE
-- 18 tables, 2 views, all indexes, seed data loaded.
-- 72 project nodes across 6 businesses. 15 contacts seeded.
-- ============================================================================
