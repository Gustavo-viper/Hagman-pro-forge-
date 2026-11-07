/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_APP_ENV?: 'development' | 'staging' | 'production';
  /** Test builds only: exposes offline rendering of the soundtracks. */
  readonly VITE_MUSIC_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
