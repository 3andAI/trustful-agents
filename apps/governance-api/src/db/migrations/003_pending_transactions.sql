-- Migration: 003_pending_transactions.sql
-- Stores metadata for Safe transactions so governance members can see what they're voting on

CREATE TABLE IF NOT EXISTS pending_transactions (
  safe_tx_hash VARCHAR(66) PRIMARY KEY,
  action_type VARCHAR(50) NOT NULL,  -- create_council, add_member, remove_member, close_council
  title VARCHAR(200) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',  -- Additional context (council_id, member_address, etc.)
  proposed_by VARCHAR(42) NOT NULL,
  proposed_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending',  -- pending, executed, rejected, expired
  executed_at TIMESTAMPTZ,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'executed', 'rejected', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_pending_tx_status ON pending_transactions(status);
CREATE INDEX IF NOT EXISTS idx_pending_tx_proposed_at ON pending_transactions(proposed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_tx_proposed_by ON pending_transactions(LOWER(proposed_by));
