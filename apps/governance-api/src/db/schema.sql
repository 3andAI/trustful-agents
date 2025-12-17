-- ============================================================================
-- Trustful Agents Governance Database Schema
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Governance Signers (Safe multisig owners)
-- ============================================================================

CREATE TABLE IF NOT EXISTS governance_signers (
    address VARCHAR(42) PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_governance_signers_email ON governance_signers(email);

-- ============================================================================
-- Council Members (metadata for on-chain members)
-- ============================================================================

CREATE TABLE IF NOT EXISTS council_members (
    id SERIAL PRIMARY KEY,
    address VARCHAR(42) NOT NULL,
    council_id VARCHAR(66) NOT NULL, -- bytes32 as hex (0x + 64 chars)
    name VARCHAR(255),
    description TEXT,
    email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(address, council_id)
);

CREATE INDEX IF NOT EXISTS idx_council_members_council ON council_members(council_id);
CREATE INDEX IF NOT EXISTS idx_council_members_address ON council_members(address);
CREATE INDEX IF NOT EXISTS idx_council_members_email ON council_members(email);

-- ============================================================================
-- Sessions (SIWE authentication)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address VARCHAR(42) NOT NULL,
    nonce VARCHAR(32) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_address ON sessions(address);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ============================================================================
-- Audit Log
-- ============================================================================

CREATE TYPE audit_action AS ENUM (
    'council_created',
    'council_closed',
    'council_updated',
    'member_added',
    'member_removed',
    'member_metadata_updated',
    'agent_reassigned',
    'safe_tx_proposed',
    'safe_tx_signed',
    'safe_tx_executed'
);

CREATE TYPE target_type AS ENUM (
    'council',
    'member',
    'agent',
    'safe_tx'
);

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    action audit_action NOT NULL,
    actor_address VARCHAR(42) NOT NULL,
    target_type target_type NOT NULL,
    target_id VARCHAR(255) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_address);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- ============================================================================
-- Email Queue
-- ============================================================================

CREATE TYPE email_template AS ENUM (
    'council_deletion_proposed',
    'council_deleted',
    'council_deletion_rejected',
    'member_added',
    'member_removed',
    'vote_required'
);

CREATE TYPE email_status AS ENUM (
    'pending',
    'sent',
    'failed'
);

CREATE TABLE IF NOT EXISTS email_queue (
    id SERIAL PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    template email_template NOT NULL,
    variables JSONB DEFAULT '{}',
    status email_status DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled ON email_queue(scheduled_at) WHERE status = 'pending';

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_governance_signers_updated_at
    BEFORE UPDATE ON governance_signers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_council_members_updated_at
    BEFORE UPDATE ON council_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Cleanup Job (run periodically via cron or pg_cron)
-- ============================================================================

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to retry failed emails (max 3 attempts)
CREATE OR REPLACE FUNCTION reset_failed_emails()
RETURNS INTEGER AS $$
DECLARE
    reset_count INTEGER;
BEGIN
    UPDATE email_queue 
    SET status = 'pending', 
        scheduled_at = NOW() + INTERVAL '5 minutes'
    WHERE status = 'failed' 
      AND attempts < 3;
    GET DIAGNOSTICS reset_count = ROW_COUNT;
    RETURN reset_count;
END;
$$ LANGUAGE plpgsql;
