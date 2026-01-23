/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
  readonly VITE_CLAIMS_MANAGER_ADDRESS: string;
  readonly VITE_RULING_EXECUTOR_ADDRESS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
