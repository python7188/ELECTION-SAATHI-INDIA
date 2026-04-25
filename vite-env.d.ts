/// <reference types="vite/client" />

/**
 * Environment variable declarations for Election Saathi India.
 * All secrets are loaded via environment variables — never hardcoded.
 */
interface ImportMetaEnv {
  /** Google Gemini / Vertex AI API key */
  readonly VITE_GEMINI_API_KEY: string;
  /** Google Gemini model identifier (e.g. gemini-1.5-flash) */
  readonly VITE_GEMINI_MODEL: string;
  /** Google Cloud project ID for Vertex AI */
  readonly VITE_GOOGLE_CLOUD_PROJECT: string;
  /** Google Maps JavaScript API key */
  readonly VITE_GOOGLE_MAPS_API_KEY: string;
  /** Google Cloud Translation API key */
  readonly VITE_GOOGLE_TRANSLATION_API_KEY?: string;
  /** Application environment */
  readonly VITE_APP_ENV: 'development' | 'production' | 'test';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
