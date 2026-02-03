#!/bin/bash
# =============================================================================
# Database Query Utility - Docker Version
# =============================================================================
# Quick utility to run queries against the Docker PostgreSQL container
#
# Usage: 
#   ./db-query.sh                    # Interactive psql session
#   ./db-query.sh "SELECT * FROM councils"  # Run a single query
#   ./db-query.sh -f query.sql       # Run queries from a file
#
# =============================================================================

# Configuration - matches docker-compose.yaml
DB_NAME="${DB_NAME:-trustful_governance}"
DB_USER="postgres"
CONTAINER_NAME="trustful-postgres"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERROR: Container '$CONTAINER_NAME' is not running."
    echo ""
    echo "Start it with: docker-compose up -d postgres"
    exit 1
fi

if [ -z "$1" ]; then
    # Interactive mode
    echo "Connecting to $DB_NAME (interactive mode)..."
    echo "Type \\q to exit"
    echo ""
    docker exec -it "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"
elif [ "$1" == "-f" ] && [ -n "$2" ]; then
    # File mode
    if [ ! -f "$2" ]; then
        echo "ERROR: File not found: $2"
        exit 1
    fi
    docker cp "$2" "$CONTAINER_NAME:/tmp/query.sql"
    docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -f /tmp/query.sql
    docker exec "$CONTAINER_NAME" rm /tmp/query.sql
else
    # Single query mode
    docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "$1"
fi
