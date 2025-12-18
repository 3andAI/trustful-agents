-- Migration: Add proposals and votes tables for off-chain governance voting
-- Run this against your existing database

-- ============================================================================
-- Create ENUMs
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

DO $$ BEGIN
    CREATE TYPE vote_choice AS ENUM (
        'aye',
        'nay',
        'abstain'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- Proposals Table
-- ============================================================================

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
-- Votes Table
-- ============================================================================

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
-- Helper Function (must be defined before triggers)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

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
-- Verify migration
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration complete. Tables created: proposals, votes';
END $$;
