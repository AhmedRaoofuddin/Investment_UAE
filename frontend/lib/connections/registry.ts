// Connection provider catalogue.
//
// Adding a new provider:
//   1. Implement the `ConnectionProvider` interface in providers/<id>.ts
//   2. Import it here and append to PROVIDERS.
//   3. Add an icon mapping to components/workspace/ConnectionIcon.tsx.
//   4. If it's OAuth, register the callback route in
//      app/api/connections/[provider]/callback/route.ts (uses the central handler).
//
// The catalogue is intentionally hand-curated — we don't dynamically
// discover providers, so a malicious package can't register itself as
// a connection.

import type { ConnectionProvider, ProviderCatalogueEntry } from "./types";
import { googleDriveProvider } from "./providers/googleDrive";
import { notionProvider } from "./providers/notion";
import { slackProvider } from "./providers/slack";
import { mcpFilesystemProvider } from "./providers/mcpFilesystem";
import { adxProvider } from "./providers/adx";

const PROVIDERS: ConnectionProvider[] = [
  googleDriveProvider,
  notionProvider,
  slackProvider,
  mcpFilesystemProvider,
  adxProvider,
];

export function listProviders(): ProviderCatalogueEntry[] {
  return PROVIDERS.map((p) => p.meta);
}

export function getProvider(id: string): ConnectionProvider | undefined {
  return PROVIDERS.find((p) => p.meta.id === id);
}
