/// <reference types="vite/client" />

// Buffer polyfill type declaration
declare global {
  interface Window {
    Buffer: typeof import('buffer').Buffer
  }
  const Buffer: typeof import('buffer').Buffer
}
