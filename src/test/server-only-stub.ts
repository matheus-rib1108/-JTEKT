// Test-only stub: the real "server-only" package throws unless the bundler
// resolves the "react-server" export condition (which Next.js sets up, but
// Vitest does not). Aliased in vitest.config.ts so unit tests can import
// server-side modules without pulling in Next's bundler machinery.
export {};
