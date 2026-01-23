-- Migration: 004_claims_metadata.sql
-- Add this file to governance-api/src/db/migrations/

-- Track claim metadata (IPFS content, titles, etc.)
CREATE TABLE IF NOT EXISTS claim_metadata (
  claim_id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  evidence_summary TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Track evidence submissions with richer metadata
CREATE TABLE IF NOT EXISTS claim_evidence (
  id SERIAL PRIMARY KEY,
  claim_id TEXT NOT NULL,
  submitter_address TEXT NOT NULL,
  evidence_hash TEXT NOT NULL,
  evidence_uri TEXT NOT NULL,
  evidence_type TEXT DEFAULT 'primary', -- primary, additional, counter
  title TEXT,
  description TEXT,
  submitted_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(claim_id, evidence_hash)
);

-- Track votes with reasoning (off-chain supplement to on-chain data)
CREATE TABLE IF NOT EXISTS vote_reasoning (
  id SERIAL PRIMARY KEY,
  claim_id TEXT NOT NULL,
  voter_address TEXT NOT NULL,
  reasoning_full TEXT, -- Full reasoning if too long for chain
  reasoning_hash TEXT, -- Hash to verify against on-chain
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(claim_id, voter_address)
);

-- Council member voting history (cached for performance)
CREATE TABLE IF NOT EXISTS member_voting_history (
  id SERIAL PRIMARY KEY,
  member_address TEXT NOT NULL,
  council_id TEXT NOT NULL,
  claim_id TEXT NOT NULL,
  vote TEXT NOT NULL, -- Approve, Reject, Abstain
  approved_amount TEXT,
  voted_at TIMESTAMP NOT NULL,
  was_changed BOOLEAN DEFAULT FALSE,
  last_changed_at TIMESTAMP,
  outcome TEXT, -- Approved, Rejected, Expired (set after finalization)
  deposit_share TEXT, -- Share of deposit received
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(member_address, claim_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_claim_evidence_claim_id ON claim_evidence(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_evidence_submitter ON claim_evidence(submitter_address);
CREATE INDEX IF NOT EXISTS idx_vote_reasoning_claim ON vote_reasoning(claim_id);
CREATE INDEX IF NOT EXISTS idx_member_voting_member ON member_voting_history(member_address);
CREATE INDEX IF NOT EXISTS idx_member_voting_council ON member_voting_history(council_id);
CREATE INDEX IF NOT EXISTS idx_member_voting_claim ON member_voting_history(claim_id);
