#!/bin/bash
# =============================================================================
# Rollback Database - Docker Version
# =============================================================================
# Restores the database from a backup file into Docker container
#
# Usage: ./rollback-database.sh <backup_file> [database_name]
# Example: ./rollback-database.sh ./backups/trustful_governance_backup_20250127_120000.sql
#
# =============================================================================

set -e

# Configuration - matches docker-compose.yaml
BACKUP_FILE="$1"
DB_NAME="${2:-trustful_governance}"
DB_USER="postgres"
CONTAINER_NAME="trustful-postgres"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: ./rollback-database.sh <backup_file> [database_name]"
    echo ""
    echo "Available backups:"
    if [ -d "./backups" ]; then
        ls -lh ./backups/*.sql 2>/dev/null || echo "  No .sql backups found"
        ls -lh ./backups/*.sql.gz 2>/dev/null || echo "  No .sql.gz backups found"
    else
        echo "  No backups directory found"
    fi
    exit 1
fi

# Handle .gz files
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo "Decompressing backup..."
    gunzip -k "$BACKUP_FILE" 2>/dev/null || true
    BACKUP_FILE="${BACKUP_FILE%.gz}"
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "============================================"
echo "  Trustful Agents Database Rollback (Docker)"
echo "============================================"
echo ""
echo "Container:   $CONTAINER_NAME"
echo "Database:    $DB_NAME"
echo "Backup file: $BACKUP_FILE"
echo ""
echo "⚠️  WARNING: This will:"
echo "   1. DROP the existing '$DB_NAME' database"
echo "   2. CREATE a new '$DB_NAME' database"
echo "   3. RESTORE from the backup"
echo ""
read -p "Are you sure? Type 'ROLLBACK' to confirm: " CONFIRM

if [ "$CONFIRM" != "ROLLBACK" ]; then
    echo "Aborted."
    exit 1
fi

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERROR: Container '$CONTAINER_NAME' is not running."
    echo ""
    echo "Start it with: docker-compose up -d postgres"
    exit 1
fi

echo ""
echo "Step 1: Terminating active connections..."
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "
    SELECT pg_terminate_backend(pid) 
    FROM pg_stat_activity 
    WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();
" 2>/dev/null || true

echo "Step 2: Dropping database..."
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"

echo "Step 3: Creating fresh database..."
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;"

echo "Step 4: Restoring from backup..."
# Copy backup file into container and restore
docker cp "$BACKUP_FILE" "$CONTAINER_NAME:/tmp/restore.sql"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -f /tmp/restore.sql
docker exec "$CONTAINER_NAME" rm /tmp/restore.sql

echo ""
echo "✅ Rollback complete!"
echo ""
echo "Database '$DB_NAME' has been restored from backup."
echo ""
echo "Verify with:"
echo "  docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c '\\dt'"
echo ""
