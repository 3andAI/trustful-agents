# governance-api/src/config

This directory contains the API's central configuration module.

## Files

- `index.ts` — Central config module. All routes and services import from here.
- `contracts.ts` — **Symlink** to `../../config/generated/contracts.ts`

## Setup

After running `config/scripts/generate.sh`, create the symlink:

```bash
cd governance-api/src/config
ln -sf ../../../config/generated/contracts.ts contracts.ts
```

The `index.ts` module re-exports everything from `contracts.ts` and adds
runtime-only configuration (publicClient, database URL, secrets from env).
