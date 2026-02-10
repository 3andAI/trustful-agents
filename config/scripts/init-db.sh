#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# init-db.sh — Create or reset PostgreSQL database for a network
#
# Creates a network-specific database (e.g. trustful_governance_sepolia) and
# runs the schema migration. Supports running multiple network databases on
# the same PostgreSQL instance simultaneously.
#
# Usage: ./config/scripts/init-db.sh [network] [--reset]
#        Default network: base-sepolia
#        --reset: Drop and recreate the database (DESTRUCTIVE!)
#
# Expects:
#   - PostgreSQL running (via Docker or native)
#   - DATABASE_USER and DATABASE_PASSWORD in environment or .env.local
#   - governance-api/src/db/schema.sql exists
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$CONFIG_DIR")"
NETWORK="${1:-base-sepolia}"
RESET=""

# Parse args
for arg in "$@"; do
  case $arg in
    --reset) RESET="true" ;;
  esac
done

NETWORK_FILE="$CONFIG_DIR/networks/${NETWORK}.json"
SCHEMA_FILE="$ROOT_DIR/governance-api/src/db/schema.sql"

if [ ! -f "$NETWORK_FILE" ]; then
  echo "ERROR: Network config not found: $NETWORK_FILE"
  exit 1
fi

if [ ! -f "$SCHEMA_FILE" ]; then
  echo "ERROR: Schema file not found: $SCHEMA_FILE"
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo "ERROR: jq is required. Install with: sudo apt install jq"
  exit 1
fi

# Read database config from network JSON
DB_NAME=$(jq -r '.database.name' "$NETWORK_FILE")
DB_PORT=$(jq -r '.database.port' "$NETWORK_FILE")

# Read credentials from environment or .env.local
DB_USER="${DATABASE_USER:-postgres}"
DB_PASSWORD="${DATABASE_PASSWORD:-postgres}"
DB_HOST="${DATABASE_HOST:-localhost}"

# Load .env.local if it exists (for secrets)
ENV_LOCAL="$ROOT_DIR/governance-api/.env.local"
if [ -f "$ENV_LOCAL" ]; then
  set -a
  source "$ENV_LOCAL"
  set +a
  DB_USER="${DATABASE_USER:-$DB_USER}"
  DB_PASSWORD="${DATABASE_PASSWORD:-$DB_PASSWORD}"
fi

echo "============================================"
echo "  Database Initialization"
echo "  Network: $NETWORK"
echo "  Database: $DB_NAME"
echo "  Host: $DB_HOST:$DB_PORT"
echo "  User: $DB_USER"
echo "============================================"
echo ""

PGPASSWORD="$DB_PASSWORD"
export PGPASSWORD

# Check if running in Docker
DOCKER_CONTAINER="trustful-postgres"
USE_DOCKER=false

if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${DOCKER_CONTAINER}$"; then
  USE_DOCKER=true
  echo "Detected Docker container: $DOCKER_CONTAINER"
fi

run_psql() {
  if [ "$USE_DOCKER" = true ]; then
    docker exec -i "$DOCKER_CONTAINER" psql -U "$DB_USER" "$@"
  else
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$@"
  fi
}

# Reset database if requested
if [ "$RESET" = "true" ]; then
  echo "WARNING: Dropping database '$DB_NAME'!"
  read -p "Are you sure? (type 'yes' to confirm): " confirm
  if [ "$confirm" = "yes" ]; then
    echo "Dropping database..."
    run_psql -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" postgres 2>/dev/null || true
    echo "Database dropped."
  else
    echo "Aborted."
    exit 0
  fi
fi

# Create database if it doesn't exist
echo "Creating database '$DB_NAME' if it doesn't exist..."
run_psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" postgres | grep -q 1 || \
  run_psql -c "CREATE DATABASE \"$DB_NAME\";" postgres

echo "Database exists."

# Run schema migration
echo "Running schema migration..."
if [ "$USE_DOCKER" = true ]; then
  docker exec -i "$DOCKER_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$SCHEMA_FILE"
else
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$SCHEMA_FILE"
fi

echo ""
echo "Database '$DB_NAME' initialized successfully."
echo ""
echo "Connection string:"
echo "  postgresql://$DB_USER:***@$DB_HOST:$DB_PORT/$DB_NAME"
echo ""
echo "Set in .env.local:"
echo "  DATABASE_URL=postgresql://$DB_USER:\$DATABASE_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
