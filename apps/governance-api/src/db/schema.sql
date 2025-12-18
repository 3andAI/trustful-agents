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

DO $$ BEGIN
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
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE target_type AS ENUM (
        'council',
        'member',
        'agent',
        'safe_tx'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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
-- Proposals (Off-chain governance voting)
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE proposal_type AS ENUM (
        'create_council',
        'delete_council',
        'add_member',
        'remove_member'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE proposal_status AS ENUM (
        'pending',
        'approved',
        'rejected',
        'expired',
        'executed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type proposal_type NOT NULL,
    status proposal_status DEFAULT 'pending',
    
    -- For council creation
    council_name VARCHAR(255),
    council_description TEXT,
    council_vertical VARCHAR(100),
    
    -- For council deletion / member operations
    council_id VARCHAR(66), -- bytes32 as hex
    
    -- For member operations
    member_address VARCHAR(42),
    member_name VARCHAR(255),
    member_description TEXT,
    member_email VARCHAR(255),
    
    -- Voting
    proposer_address VARCHAR(42) NOT NULL,
    votes_aye INTEGER DEFAULT 0,
    votes_nay INTEGER DEFAULT 0,
    votes_abstain INTEGER DEFAULT 0,
    threshold INTEGER NOT NULL, -- Required votes for approval
    
    -- Timing
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE,
    
    -- Safe transaction (after approval)
    safe_tx_hash VARCHAR(66),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_type ON proposals(type);
CREATE INDEX IF NOT EXISTS idx_proposals_council ON proposals(council_id);
CREATE INDEX IF NOT EXISTS idx_proposals_expires ON proposals(expires_at) WHERE status = 'pending';

-- ============================================================================
-- Votes (Individual votes on proposals)
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE vote_choice AS ENUM (
        'aye',
        'nay',
        'abstain'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS votes (
    id SERIAL PRIMARY KEY,
    proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    voter_address VARCHAR(42) NOT NULL,
    choice vote_choice NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(proposal_id, voter_address)
);

CREATE INDEX IF NOT EXISTS idx_votes_proposal ON votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter ON votes(voter_address);

-- ============================================================================
-- Email Queue
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE email_template AS ENUM (
        'council_deletion_proposed',
        'council_deleted',
        'council_deletion_rejected',
        'member_added',
        'member_removed',
        'vote_required'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE email_status AS ENUM (
        'pending',
        'sent',
        'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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
DROP TRIGGER IF EXISTS update_governance_signers_updated_at ON governance_signers;
CREATE TRIGGER update_governance_signers_updated_at
    BEFORE UPDATE ON governance_signers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_council_members_updated_at ON council_members;
CREATE TRIGGER update_council_members_updated_at
    BEFORE UPDATE ON council_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_votes_updated_at ON votes;
CREATE TRIGGER update_votes_updated_at
    BEFORE UPDATE ON votes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_proposals_updated_at ON proposals;
CREATE TRIGGER update_proposals_updated_at
    BEFORE UPDATE ON proposals
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
