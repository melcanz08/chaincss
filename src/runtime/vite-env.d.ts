/// <reference types="vite/client" />

interface ImportMeta {
  readonly hot?: {
    accept(cb: (mod: any) => void): void;
    on(event: string, cb: (data: any) => void): void;
  };
}