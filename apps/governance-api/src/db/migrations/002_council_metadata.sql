-- Migration: 002_council_metadata.sql
-- Adds metadata tables for off-chain council and member information
-- These tables supplement on-chain data with display names, emails, notes, etc.

-- ============================================================================
-- Council Metadata Table
-- Stores additional info not stored on-chain
-- ============================================================================

CREATE TABLE IF NOT EXISTS council_metadata (
  council_id VARCHAR(66) PRIMARY KEY,  -- bytes32 as hex string
  display_name VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_council_metadata_updated ON council_metadata(updated_at);

-- ============================================================================
-- Council Members Table
-- Stores member metadata (name, email, description)
-- ============================================================================

CREATE TABLE IF NOT EXISTS council_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address VARCHAR(42) NOT NULL,
  council_id VARCHAR(66) NOT NULL,
  name VARCHAR(100),
  email VARCHAR(255),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(address, council_id)
);

CREATE INDEX IF NOT EXISTS idx_council_members_address ON council_members(LOWER(address));
CREATE INDEX IF NOT EXISTS idx_council_members_council ON council_members(council_id);

-- ============================================================================
-- Trigger for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_council_metadata_updated_at ON council_metadata;
CREATE TRIGGER update_council_metadata_updated_at
  BEFORE UPDATE ON council_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_council_members_updated_at ON council_members;
CREATE TRIGGER update_council_members_updated_at
  BEFORE UPDATE ON council_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
