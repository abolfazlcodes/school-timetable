CREATE TYPE school_role AS ENUM ('ADMIN', 'VICE_PRINCIPAL');

CREATE TABLE users (
  id uuid PRIMARY KEY,
  email varchar(254) NOT NULL,
  full_name varchar(120) NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_normalized CHECK (email = lower(trim(email)))
);

CREATE UNIQUE INDEX users_email_lower_unique ON users (email);

CREATE TABLE schools (
  id uuid PRIMARY KEY,
  name varchar(160) NOT NULL,
  code varchar(32),
  province varchar(80),
  city varchar(80),
  phone varchar(24),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schools_name_not_blank CHECK (length(trim(name)) >= 2)
);

CREATE UNIQUE INDEX schools_code_unique ON schools (code) WHERE code IS NOT NULL;

CREATE TABLE school_memberships (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role school_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_memberships_pk PRIMARY KEY (user_id, school_id)
);

CREATE INDEX school_memberships_school_idx ON school_memberships (school_id);

CREATE TABLE sessions (
  id uuid PRIMARY KEY,
  token_hash varchar(64) NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active_school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sessions_token_hash_length CHECK (length(token_hash) = 64)
);

CREATE UNIQUE INDEX sessions_token_hash_unique ON sessions (token_hash);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expiry_idx ON sessions (expires_at);

-- نشست فقط می‌تواند مدرسه‌ای را انتخاب کند که کاربر عضو آن است.
ALTER TABLE sessions
  ADD CONSTRAINT sessions_active_membership_fk
  FOREIGN KEY (user_id, active_school_id)
  REFERENCES school_memberships (user_id, school_id)
  ON DELETE CASCADE;
