// The NIDS decoder is plain JS with no types. We cast its output to explicit
// shapes in decode.ts, so declaring the modules as `any` is sufficient.
declare module 'nexrad-level-3-data';
declare module 'nexrad-level-3-data/src/products';
declare module 'nexrad-level-3-data/src/products/94';

// Injected by Vite (see vite.config.ts) — app version from package.json.
declare const __APP_VERSION__: string;
