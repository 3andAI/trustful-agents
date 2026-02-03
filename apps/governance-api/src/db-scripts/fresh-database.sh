#!/bin/bash
# =============================================================================
# Fresh Database Setup - Docker Version
# =============================================================================
# Creates a fresh database with the current schema in Docker container
#
# Usage: ./fresh-database.sh [schema_path] [database_name]
# Example: ./fresh-database.sh ../governance-api/src/db/schema.sql trustful_governance
#
# =============================================================================

set -e

# Configuration - matches docker-compose.yaml
SCHEMA_PATH="${1:-./schema.sql}"
DB_NAME="${2:-trustful_governance}"
DB_USER="postgres"
CONTAINER_NAME="trustful-postgres"

echo "============================================"
echo "  Trustful Agents Fresh Database (Docker)"
echo "============================================"
echo ""
echo "Container: $CONTAINER_NAME"
echo "Database:  $DB_NAME"
echo "Schema:    $SCHEMA_PATH"
echo ""

# Check if schema file exists
if [ ! -f "$SCHEMA_PATH" ]; then
    echo "ERROR: Schema file not found: $SCHEMA_PATH"
    echo ""
    echo "Usage: ./fresh-database.sh <schema_path> [database_name]"
    echo ""
    echo "Common schema locations:"
    echo "  ./schema.sql"
    echo "  ../governance-api/src/db/schema.sql"
    echo "  /path/to/your/schema.sql"
    exit 1
fi

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERROR: Container '$CONTAINER_NAME' is not running."
    echo ""
    echo "Start it with: docker-compose up -d postgres"
    exit 1
fi

echo "⚠️  WARNING: This will DROP the existing '$DB_NAME' database!"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
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

echo "Step 4: Applying schema..."
docker cp "$SCHEMA_PATH" "$CONTAINER_NAME:/tmp/schema.sql"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -f /tmp/schema.sql
docker exec "$CONTAINER_NAME" rm /tmp/schema.sql

# Check for migrations directory
MIGRATIONS_DIR="$(dirname "$SCHEMA_PATH")/migrations"
if [ -d "$MIGRATIONS_DIR" ]; then
    echo "Step 5: Applying migrations..."
    for migration in "$MIGRATIONS_DIR"/*.sql; do
        if [ -f "$migration" ]; then
            echo "  - Applying: $(basename $migration)"
            docker cp "$migration" "$CONTAINER_NAME:/tmp/migration.sql"
            docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -f /tmp/migration.sql
            docker exec "$CONTAINER_NAME" rm /tmp/migration.sql
        fi
    done
fi

echo ""
echo "✅ Fresh database setup complete!"
echo ""
echo "Tables created:"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c '\dt'
echo ""
