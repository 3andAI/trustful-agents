#!/bin/bash
#
# fresh-database-v13.sh
# Sets up a fresh database for v1.3 deployment
#
# Usage:
#   ./fresh-database-v13.sh [schema_file]
#
# This script:
#   1. Drops the existing database (with confirmation)
#   2. Creates a new database
#   3. Applies the base schema
#   4. Applies the v1.3 migration
#

set -e

# Configuration
DB_NAME="${DB_NAME:-trustful_agents}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_FILE="${1:-$SCRIPT_DIR/../governance-api/src/db/schema.sql}"
MIGRATION_FILE="$SCRIPT_DIR/004_claim_conversations_v13.sql"

echo "============================================"
echo "  Trustful Agents v1.3 Fresh Database Setup"
echo "============================================"
echo ""
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Host: $DB_HOST"
echo ""
echo "Schema file: $SCHEMA_FILE"
echo "Migration file: $MIGRATION_FILE"
echo ""

# Verify files exist
if [ ! -f "$SCHEMA_FILE" ]; then
    echo "ERROR: Schema file not found: $SCHEMA_FILE"
    echo ""
    echo "Please provide the path to your schema.sql file:"
    echo "  ./fresh-database-v13.sh /path/to/governance-api/src/db/schema.sql"
    exit 1
fi

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "ERROR: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "⚠️  WARNING: This will completely DROP and RECREATE the database!"
echo ""
read -p "Type the database name to confirm: " CONFIRM

if [ "$CONFIRM" != "$DB_NAME" ]; then
    echo "Confirmation failed. Aborted."
    exit 1
fi

echo ""
echo "Step 1: Terminating active connections..."
psql -U "$DB_USER" -h "$DB_HOST" -d postgres -c "
    SELECT pg_terminate_backend(pid) 
    FROM pg_stat_activity 
    WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();
" 2>/dev/null || true

echo "Step 2: Dropping existing database..."
psql -U "$DB_USER" -h "$DB_HOST" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"

echo "Step 3: Creating fresh database..."
psql -U "$DB_USER" -h "$DB_HOST" -d postgres -c "CREATE DATABASE $DB_NAME;"

echo "Step 4: Applying base schema..."
psql -U "$DB_USER" -h "$DB_HOST" -d "$DB_NAME" -f "$SCHEMA_FILE"

echo "Step 5: Applying v1.3 migration (004_claim_conversations_v13.sql)..."
psql -U "$DB_USER" -h "$DB_HOST" -d "$DB_NAME" -f "$MIGRATION_FILE"

echo ""
echo "============================================"
echo "  Fresh Database Setup Complete"
echo "============================================"
echo ""
echo "Database '$DB_NAME' is ready for v1.3"
echo ""
echo "Tables:"
psql -U "$DB_USER" -h "$DB_HOST" -d "$DB_NAME" -c "\dt" 2>/dev/null || true
echo ""
echo "Next steps:"
echo "  1. Update governance-api/.env with new contract addresses"
echo "  2. Restart the governance-api: pm2 restart governance-api"
echo "  3. Deploy the updated subgraph"
echo ""
