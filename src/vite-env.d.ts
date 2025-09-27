/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_URL?: string;
  // başka public env değişkenlerin olursa buraya ekleyebilirsin
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
