/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BUSINESS_PLATFORM_URL?: string;
  readonly VITE_BUSINESS_PLATFORM_HOST?: string;
  readonly VITE_BUSINESS_PLATFORM_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
