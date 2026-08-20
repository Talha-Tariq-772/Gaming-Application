// Vitest runs in plain Node, not Next's build pipeline, so the real
// "server-only" package (which throws unconditionally outside Next's
// react-server resolve condition) would break every test that imports a
// server-only module. This stub is aliased in vitest.config.mts for tests
// only — production builds still resolve the real package.
export {};
