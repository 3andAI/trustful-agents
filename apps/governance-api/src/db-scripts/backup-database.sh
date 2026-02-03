#!/bin/bash
# =============================================================================
# Backup Database - Docker Version
# =============================================================================
# Creates a backup of the Trustful Governance database from Docker container
#
# Usage: ./backup-database.sh [database_name]
# Example: ./backup-database.sh trustful_governance
#
# =============================================================================

set -e

# Configuration - matches docker-compose.yaml
DB_NAME="${1:-trustful_governance}"
DB_USER="postgres"
CONTAINER_NAME="trustful-postgres"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_backup_${TIMESTAMP}.sql"

echo "============================================"
echo "  Trustful Agents Database Backup (Docker)"
echo "============================================"
echo ""
echo "Container: $CONTAINER_NAME"
echo "Database:  $DB_NAME"
echo "Backup:    $BACKUP_FILE"
echo ""

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERROR: Container '$CONTAINER_NAME' is not running."
    echo ""
    echo "Start it with: docker-compose up -d postgres"
    exit 1
fi

# Check if database exists
if ! docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "WARNING: Database '$DB_NAME' does not exist. Nothing to backup."
    exit 0
fi

# Create full backup using docker exec (no password needed)
echo "Creating backup..."
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"

# Also create a compressed version
echo "Compressing..."
gzip -k "$BACKUP_FILE"

# Get file sizes
SQL_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
GZ_SIZE=$(ls -lh "${BACKUP_FILE}.gz" | awk '{print $5}')

echo ""
echo "✅ Backup created successfully!"
echo ""
echo "Files:"
echo "  - $BACKUP_FILE ($SQL_SIZE)"
echo "  - ${BACKUP_FILE}.gz ($GZ_SIZE)"
echo ""
echo "To restore from this backup:"
echo "  ./rollback-database.sh $BACKUP_FILE"
echo ""
