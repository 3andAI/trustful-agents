# Trustful Agents Database Scripts (Docker Version)

Database management scripts for Trustful Governance running in Docker.

## Configuration

These scripts are configured to match your `docker-compose.yaml`:

| Setting | Value |
|---------|-------|
| Container | `trustful-postgres` |
| Database | `trustful_governance` |
| User | `postgres` |
| Password | `postgres` (not needed - uses docker exec) |

## Scripts

### backup-database.sh
Creates a backup of the database.

```bash
chmod +x backup-database.sh
./backup-database.sh
```

Output:
- `backups/trustful_governance_backup_YYYYMMDD_HHMMSS.sql`
- `backups/trustful_governance_backup_YYYYMMDD_HHMMSS.sql.gz`

### rollback-database.sh
Restores the database from a backup.

```bash
./rollback-database.sh ./backups/trustful_governance_backup_20250127_120000.sql
```

⚠️ This will DROP the existing database and restore from backup!

### fresh-database.sh
Creates a fresh database with schema and migrations.

```bash
./fresh-database.sh ../governance-api/src/db/schema.sql
```

⚠️ This will DROP the existing database!

### db-status.sh
Shows database status, tables, and row counts.

```bash
./db-status.sh
```

### db-query.sh
Run queries against the database.

```bash
# Interactive psql session
./db-query.sh

# Run a single query
./db-query.sh "SELECT * FROM councils"

# Run queries from a file
./db-query.sh -f my-query.sql
```

## Quick Reference

```bash
# Make all scripts executable
chmod +x *.sh

# Check database status
./db-status.sh

# Create a backup before making changes
./backup-database.sh

# Query the database
./db-query.sh "SELECT COUNT(*) FROM claims"

# Interactive psql session
./db-query.sh

# Restore from backup if something goes wrong
./rollback-database.sh ./backups/trustful_governance_backup_XXXXXXXX_XXXXXX.sql
```

## Environment Variables

You can override defaults with environment variables:

```bash
export DB_NAME=my_other_database
./backup-database.sh
```

## Troubleshooting

### "Container is not running"
```bash
docker-compose up -d postgres
```

### Check container logs
```bash
docker logs trustful-postgres
```

### Connect directly to psql
```bash
docker exec -it trustful-postgres psql -U postgres -d trustful_governance
```
