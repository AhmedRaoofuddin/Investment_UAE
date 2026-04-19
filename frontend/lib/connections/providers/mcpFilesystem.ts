// MCP server connection — server-side gateway pattern.
//
// IMPORTANT: MCP servers run inside our infrastructure, NOT on the user's
// machine. The user grants the workspace access to a scoped path / store
// (e.g. a S3 bucket, a Tigris namespace) and our backend hosts the MCP
// server speaking that protocol. Reasons:
//   1. We never want a user-supplied MCP binary to execute in our process.
//   2. The agent must not see the user's full filesystem; only the namespaced
//      mount we expose.
//   3. We can audit every tool call centrally.
//
// This pilot entry is a placeholder pointing at a hosted filesystem MCP
// scoped to a tenant-prefixed Tigris namespace. Configuration done via the
// API-key path (the user pastes a write token issued from our admin UI).

import type { ConnectionProvider } from "../types";

export const mcpFilesystemProvider: ConnectionProvider = {
  meta: {
    id: "mcp:filesystem",
    kind: "MCP_SERVER",
    name: "MCP: Workspace Files",
    description:
      "Hosted MCP server scoped to your tenant's encrypted file store. Drop documents in, agent picks them up.",
    iconKey: "mcp",
    tiers: ["VERIFIED", "INSTITUTION"],
    docsUrl: "https://modelcontextprotocol.io",
    // We expose a UI tile but the server-side wiring is built per-tenant
    // when an admin issues the namespace token, so PILOT tier doesn't see
    // the connect button.
    ready: false,
  },
  async validateApiKey(key: string) {
    if (!/^mcp_[A-Za-z0-9_-]{20,}$/.test(key)) {
      return { ok: false, error: "Token format is mcp_<20+ chars>" };
    }
    return { ok: true };
  },
};
