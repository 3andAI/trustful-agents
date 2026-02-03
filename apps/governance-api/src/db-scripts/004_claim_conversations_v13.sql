-- =============================================================================
-- Migration: 004_claim_conversations_v13.sql
-- Version: 1.3
-- Description: Claim discussion threads with DB-stored evidence (not IPFS)
-- =============================================================================
--
-- CHANGES FROM ORIGINAL 004_claim_conversations.sql:
--   - REMOVED: evidence_uri (was for IPFS URLs like ipfs://Qm...)
--   - ADDED: evidence_data (TEXT - base64 data URI)
--   - ADDED: evidence_mimetype (VARCHAR - for content-type)
--   - ADDED: evidence_size constraint (max 10KB)
--
-- This migration should REPLACE the original 004_claim_conversations.sql
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ENUM: Author roles in claim discussions
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE claim_author_role AS ENUM ('claimer', 'provider', 'council');
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'claim_author_role already exists, skipping';
END $$;

-- =============================================================================
-- TABLE: claim_metadata
-- Stores additional claim info not on-chain (title, description)
-- =============================================================================

CREATE TABLE IF NOT EXISTS claim_metadata (
    claim_id BIGINT PRIMARY KEY,
    
    -- Claim title/summary (optional)
    title VARCHAR(255),
    
    -- Detailed description of the claim
    description TEXT NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE claim_metadata IS 'Off-chain metadata for claims (title, description)';

-- =============================================================================
-- TABLE: claim_messages
-- Threaded discussion between claimer, provider, and council members
-- v1.3: Evidence stored in DB as base64, NOT on IPFS
-- =============================================================================

CREATE TABLE IF NOT EXISTS claim_messages (
    -- Primary key (UUID for distributed-friendly IDs)
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Claim this message belongs to
    claim_id BIGINT NOT NULL,
    
    -- Parent message for threading (NULL = top-level message)
    parent_id UUID REFERENCES claim_messages(id) ON DELETE CASCADE,
    
    -- Author information
    author_address VARCHAR(42) NOT NULL,  -- Ethereum address (0x...)
    author_role claim_author_role NOT NULL,
    
    -- Message content
    content TEXT NOT NULL,
    
    -- ==========================================================================
    -- Evidence attachment (v1.3: DB-stored, not IPFS)
    -- ==========================================================================
    
    -- Hash for integrity verification (optional, keccak256 of original file)
    evidence_hash VARCHAR(66),
    
    -- Base64 data URI containing the file content
    -- Format: "data:<mimetype>;base64,<encoded_content>"
    -- Example: "data:application/pdf;base64,JVBERi0xLjQKJeLjz9..."
    -- Max size: ~13.3KB base64 (from 10KB original file)
    evidence_data TEXT,
    
    -- Original filename for display/download
    evidence_filename VARCHAR(255),
    
    -- MIME type for proper rendering
    -- Examples: application/pdf, image/png, image/jpeg, text/plain
    evidence_mimetype VARCHAR(100),
    
    -- Original file size in bytes (before base64 encoding)
    -- Used for UI display and validation
    evidence_size INTEGER,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- ==========================================================================
    -- Constraints
    -- ==========================================================================
    
    -- Max file size: 10KB (10240 bytes)
    CONSTRAINT chk_evidence_size_max 
        CHECK (evidence_size IS NULL OR evidence_size <= 10240),
    
    -- If evidence_data is set, filename and size must also be set
    CONSTRAINT chk_evidence_complete
        CHECK (
            (evidence_data IS NULL AND evidence_filename IS NULL AND evidence_size IS NULL)
            OR 
            (evidence_data IS NOT NULL AND evidence_filename IS NOT NULL AND evidence_size IS NOT NULL)
        )
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Primary query: get all messages for a claim
CREATE INDEX IF NOT EXISTS idx_claim_messages_claim_id 
    ON claim_messages(claim_id);

-- Threading: get replies to a message
CREATE INDEX IF NOT EXISTS idx_claim_messages_parent_id 
    ON claim_messages(parent_id);

-- Query by author
CREATE INDEX IF NOT EXISTS idx_claim_messages_author 
    ON claim_messages(author_address);

-- Timeline view
CREATE INDEX IF NOT EXISTS idx_claim_messages_created 
    ON claim_messages(created_at DESC);

-- Composite: claim timeline
CREATE INDEX IF NOT EXISTS idx_claim_messages_claim_timeline 
    ON claim_messages(claim_id, created_at ASC);

-- =============================================================================
-- TRIGGER: Auto-update updated_at on claim_metadata
-- =============================================================================

-- Create the function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS trg_claim_metadata_updated_at ON claim_metadata;
CREATE TRIGGER trg_claim_metadata_updated_at
    BEFORE UPDATE ON claim_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE claim_messages IS 
    'Discussion thread for claims. v1.3: Evidence stored as base64 in DB (not IPFS).';

COMMENT ON COLUMN claim_messages.evidence_data IS 
    'Base64 data URI. Format: data:<mimetype>;base64,<content>. Max ~13KB.';

COMMENT ON COLUMN claim_messages.evidence_mimetype IS 
    'MIME type for rendering. Examples: application/pdf, image/png';

COMMENT ON COLUMN claim_messages.evidence_size IS 
    'Original file size in bytes (max 10240 = 10KB)';

COMMENT ON COLUMN claim_messages.evidence_hash IS 
    'Optional keccak256 hash of original file for integrity verification';

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
    tbl_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO tbl_count 
    FROM information_schema.tables 
    WHERE table_name IN ('claim_metadata', 'claim_messages');
    
    IF tbl_count = 2 THEN
        RAISE NOTICE '';
        RAISE NOTICE '✅ Migration 004_claim_conversations_v13.sql completed successfully';
        RAISE NOTICE '';
        RAISE NOTICE 'Tables created:';
        RAISE NOTICE '  • claim_metadata - claim titles and descriptions';
        RAISE NOTICE '  • claim_messages - threaded discussions with DB-stored evidence';
        RAISE NOTICE '';
        RAISE NOTICE 'v1.3 Changes:';
        RAISE NOTICE '  • Evidence stored in database as base64 (not IPFS)';
        RAISE NOTICE '  • Max evidence file size: 10KB';
        RAISE NOTICE '  • Supports PDF, PNG, JPEG, plain text';
        RAISE NOTICE '';
    ELSE
        RAISE WARNING 'Migration may have failed. Expected 2 tables, found %', tbl_count;
    END IF;
END $$;
