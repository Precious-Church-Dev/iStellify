CREATE TABLE IF NOT EXISTS members (
 id TEXT PRIMARY KEY, pcm TEXT NOT NULL UNIQUE CHECK (pcm ~ '^PCM[0-9]{4}$'),
 name TEXT NOT NULL, nickname TEXT NOT NULL DEFAULT '', tag TEXT NOT NULL DEFAULT 'iStellify',
 email TEXT, password_hash TEXT, active BOOLEAN NOT NULL DEFAULT true,
 roles TEXT[] NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, kind TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS memberships (member_id TEXT REFERENCES members(id), group_id TEXT REFERENCES groups(id), roles TEXT[] NOT NULL DEFAULT '{}', PRIMARY KEY(member_id,group_id));
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), last_active TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0, reset_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS activation_tokens (token_hash TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS commitments (id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), habit TEXT NOT NULL, frequency TEXT NOT NULL, weekdays INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}', planned_time TEXT NOT NULL DEFAULT '', duration INTEGER NOT NULL DEFAULT 15 CHECK(duration>0 AND duration<=1440), plan TEXT NOT NULL DEFAULT '', start_date DATE NOT NULL, lock_until DATE NOT NULL, archived BOOLEAN NOT NULL DEFAULT false, UNIQUE(member_id,habit,start_date));
CREATE TABLE IF NOT EXISTS logs (id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), entered_by TEXT NOT NULL REFERENCES members(id), habit TEXT NOT NULL, period TEXT NOT NULL, data JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','flagged')), version INTEGER NOT NULL DEFAULT 1, group_ids TEXT[] NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(member_id,habit,period));
CREATE TABLE IF NOT EXISTS log_versions (id TEXT PRIMARY KEY, log_id TEXT NOT NULL REFERENCES logs(id), version INTEGER NOT NULL, data JSONB NOT NULL, status TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES members(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(log_id,version));
CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, log_id TEXT NOT NULL REFERENCES logs(id), version INTEGER NOT NULL, reviewer_id TEXT NOT NULL REFERENCES members(id), decision TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', received_cents BIGINT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, sender_id TEXT REFERENCES members(id), recipient_id TEXT NOT NULL REFERENCES members(id), message TEXT NOT NULL, day DATE NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), read_at TIMESTAMPTZ, UNIQUE(sender_id,recipient_id,day));
CREATE TABLE IF NOT EXISTS guardian_links (guardian_id TEXT REFERENCES members(id), child_id TEXT REFERENCES members(id), consent_at TIMESTAMPTZ NOT NULL, PRIMARY KEY(guardian_id,child_id));
CREATE TABLE IF NOT EXISTS imports (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES members(id), file_hash TEXT NOT NULL, payload JSONB NOT NULL, committed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS imports_committed_hash ON imports(file_hash) WHERE committed_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, actor_id TEXT REFERENCES members(id), action TEXT NOT NULL, target TEXT NOT NULL, detail JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS logs_member_period ON logs(member_id,period);
CREATE INDEX IF NOT EXISTS sessions_member ON sessions(member_id);
CREATE INDEX IF NOT EXISTS notifications_recipient ON notifications(recipient_id,created_at);
CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES members(id),log_id TEXT REFERENCES logs(id),name TEXT NOT NULL,mime TEXT NOT NULL,body BYTEA NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
ALTER TABLE logs DROP CONSTRAINT IF EXISTS logs_status_check;
ALTER TABLE logs ADD CONSTRAINT logs_status_check CHECK(status IN ('draft','pending','confirmed','flagged'));
