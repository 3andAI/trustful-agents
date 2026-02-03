#!/bin/bash
# =============================================================================
# Database Status - Docker Version
# =============================================================================
# Shows status and basic info about the Docker PostgreSQL database
#
# Usage: ./db-status.sh
#
# =============================================================================

# Configuration - matches docker-compose.yaml
DB_NAME="${DB_NAME:-trustful_governance}"
DB_USER="postgres"
CONTAINER_NAME="trustful-postgres"

echo "============================================"
echo "  Trustful Agents Database Status"
echo "============================================"
echo ""

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "❌ Container '$CONTAINER_NAME' is NOT running"
    echo ""
    echo "Start it with: docker-compose up -d postgres"
    exit 1
fi

echo "✅ Container '$CONTAINER_NAME' is running"
echo ""

# Get container info
echo "Container Info:"
docker ps --filter "name=$CONTAINER_NAME" --format "  ID: {{.ID}}\n  Image: {{.Image}}\n  Status: {{.Status}}\n  Ports: {{.Ports}}"
echo ""

# Check database exists
if docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "✅ Database '$DB_NAME' exists"
else
    echo "❌ Database '$DB_NAME' does NOT exist"
    exit 1
fi
echo ""

# Show tables
echo "Tables:"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c '\dt' 2>/dev/null || echo "  (no tables)"
echo ""

# Show row counts for key tables
echo "Row Counts:"
for table in councils council_members providers agents claims claim_metadata claim_messages; do
    count=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM $table" 2>/dev/null | tr -d ' ')
    if [ -n "$count" ]; then
        printf "  %-20s %s rows\n" "$table" "$count"
    fi
done
echo ""

# Show database size
echo "Database Size:"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME')) as size;"
echo ""

# Show active connections
echo "Active Connections:"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "SELECT count(*) as connections FROM pg_stat_activity WHERE datname = '$DB_NAME';"
echo ""
