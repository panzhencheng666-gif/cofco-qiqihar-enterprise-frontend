/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BUSINESS_PLATFORM_URL?: string;
  readonly VITE_BUSINESS_PLATFORM_HOST?: string;
  readonly VITE_BUSINESS_PLATFORM_PORT?: string;
  readonly VITE_OVERVIEW_VECTOR_STYLE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
