/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
interface ImportMetaEnv {
    // more env variables...
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }