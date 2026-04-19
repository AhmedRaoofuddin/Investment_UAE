// Ministry-grade connector catalogue — pure paste-key / paste-URL model.
//
// Rationale (Apr 2026):
//   Previously we went through Nango for OAuth. Ministry staff found the
//   OAuth handshake confusing, the Nango dashboard opaque, and the failure
//   modes ("session-failed" with no actionable next step) unprofessional
//   for a government-tier product. We now ship a single, documented flow:
//
//     1. User visits the third-party console (Slack admin, Power BI, …)
//     2. They generate a personal API key / webhook URL there
//     3. They paste it into our Connections page
//     4. We encrypt it at rest with AES-256-GCM (lib/security/encryption.ts)
//        and test connectivity server-side before saving
//
//   Every provider in this catalogue is either (a) an outbound webhook —
//   we POST to a URL the user pastes, no handshake — or (b) a bearer-token
//   API where we can verify the key with a single whoami/ping call.
//
//   Encryption: every paste goes through `sealSecret(tenantId, plaintext)`
//   with a per-tenant DEK derived via HKDF from TOKEN_VAULT_MASTER_KEY.
//   Revocation hard-deletes the ciphertext from ConnectionSecret, leaving
//   only the Connection row for audit forensics.

export type PasteFieldType = "url" | "token" | "text" | "textarea";

export interface PasteField {
  /** Stored under Connection.config (non-secret) unless `secret: true`. */
  name: string;
  label: string;
  labelKey?: string; // i18n dictionary key
  placeholder?: string;
  type: PasteFieldType;
  /** If true, encrypted via sealSecret and written to ConnectionSecret. */
  secret?: boolean;
  required?: boolean;
  /** Rendered below the field in faint text. */
  help?: string;
  helpKey?: string;
}

export interface ConnectorSpec {
  /** URL-safe id. Stable — changing this orphans existing connections. */
  id: string;
  name: string;
  nameKey?: string;
  description: string;
  descriptionKey?: string;
  /** Drives category filtering on the Connections page. */
  category: "destination" | "datasource" | "analytics" | "automation" | "comms";
  iconKey: string;
  /** Link to the third-party's own docs for getting the key. */
  docsUrl: string;
  setupSteps: string[];
  setupStepsKey?: string; // single key that resolves to a bullet list
  fields: PasteField[];
  /** Direction hint for the tile ("We → them" vs "They → us" vs both). */
  direction: "outbound" | "inbound" | "bidirectional";
  /** When false, tile shows a "Coming soon" ribbon and Connect is disabled. */
  ready: boolean;
  /** Power BI etc. */
  tags?: string[];
}

/**
 * Ministry-approved connector catalogue. Keep ordering meaningful —
 * the Connections page renders top-to-bottom in this order within each
 * category, so the most-used destinations should come first.
 */
export const CONNECTORS: ConnectorSpec[] = [
  // ── Analytics destinations ────────────────────────────────────────
  {
    id: "power-bi",
    nameKey: "workspace.connectors.providers.power-bi.name",
    descriptionKey: "workspace.connectors.providers.power-bi.description",
    name: "Microsoft Power BI",
    description:
      "Push matched signals to a Power BI streaming dataset so the Ministry dashboard updates in real time.",
    category: "analytics",
    iconKey: "power-bi",
    docsUrl: "https://learn.microsoft.com/en-us/power-bi/connect-data/service-real-time-streaming",
    setupSteps: [
      "In Power BI Service, open your workspace → New → Streaming dataset.",
      "Pick 'API' as the source; add the fields: signal_id, company, type, strength, score, detected_at, source_url.",
      "Enable Historic data analysis so past signals persist.",
      "Copy the Push URL shown on the final screen.",
      "Paste it below. We'll POST each new matched signal as JSON.",
    ],
    fields: [
      {
        name: "push_url",
        label: "Power BI push URL",
        placeholder: "https://api.powerbi.com/beta/.../datasets/.../rows?key=…",
        type: "url",
        secret: true,
        required: true,
      },
    ],
    direction: "outbound",
    ready: true,
    tags: ["analytics", "dashboard", "microsoft"],
  },
  {
    id: "tableau-webhook",
    nameKey: "workspace.connectors.providers.tableau-webhook.name",
    descriptionKey: "workspace.connectors.providers.tableau-webhook.description",
    name: "Tableau Webhook",
    description:
      "Stream signals into Tableau via a Data Update extension. Requires Tableau Cloud 2023.3+ with Webhook extension enabled.",
    category: "analytics",
    iconKey: "tableau",
    docsUrl: "https://help.tableau.com/current/pro/desktop/en-us/webhooks.htm",
    setupSteps: [
      "In Tableau Cloud, enable the Webhook extension on the target data source.",
      "Generate a webhook endpoint and copy the URL.",
      "Paste the URL below. Optional: include a bearer token.",
    ],
    fields: [
      { name: "webhook_url", label: "Webhook URL", type: "url", secret: true, required: true },
      { name: "auth_header", label: "Bearer token (optional)", type: "token", secret: true },
    ],
    direction: "outbound",
    ready: true,
    tags: ["analytics"],
  },
  {
    id: "google-sheets-webhook",
    nameKey: "workspace.connectors.providers.google-sheets-webhook.name",
    descriptionKey: "workspace.connectors.providers.google-sheets-webhook.description",
    name: "Google Sheets (via Apps Script)",
    description:
      "Append each matched signal as a row in a Google Sheet. Uses a deployed Apps Script web app URL — no OAuth, runs under your Google account.",
    category: "analytics",
    iconKey: "sheets",
    docsUrl: "https://developers.google.com/apps-script/guides/web",
    setupSteps: [
      "Open your target Google Sheet.",
      "Extensions → Apps Script. Paste the snippet from our Docs link.",
      "Deploy → New deployment → Web app. Execute as you. Access: Anyone.",
      "Copy the /exec URL and paste it below.",
    ],
    fields: [
      { name: "webhook_url", label: "Apps Script /exec URL", type: "url", secret: true, required: true },
    ],
    direction: "outbound",
    ready: true,
    tags: ["spreadsheet", "google"],
  },

  // ── Communications / alerting ────────────────────────────────────
  {
    id: "slack-webhook",
    nameKey: "workspace.connectors.providers.slack-webhook.name",
    descriptionKey: "workspace.connectors.providers.slack-webhook.description",
    name: "Slack",
    description:
      "Post matched signals into a Slack channel via an Incoming Webhook. Works with any Slack workspace — no Slack app installation required.",
    category: "comms",
    iconKey: "slack",
    docsUrl: "https://api.slack.com/messaging/webhooks",
    setupSteps: [
      "In Slack, open Apps → Browse apps → Incoming Webhooks → Add to workspace.",
      "Select the channel to post to. Slack will show a URL starting with https://hooks.slack.com/services/…",
      "Paste it below. We'll format signals as rich blocks.",
    ],
    fields: [
      { name: "webhook_url", label: "Slack Webhook URL", type: "url", secret: true, required: true },
    ],
    direction: "outbound",
    ready: true,
    tags: ["messaging"],
  },
  {
    id: "teams-webhook",
    nameKey: "workspace.connectors.providers.teams-webhook.name",
    descriptionKey: "workspace.connectors.providers.teams-webhook.description",
    name: "Microsoft Teams",
    description:
      "Send signal alerts to a Teams channel via an Incoming Webhook connector.",
    category: "comms",
    iconKey: "teams",
    docsUrl: "https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook",
    setupSteps: [
      "In Teams, open the channel → ⋯ → Connectors → Incoming Webhook.",
      "Give it a name (e.g. InvestUAE Signals) and upload an icon.",
      "Copy the Webhook URL.",
      "Paste it below. We'll send MessageCard-formatted alerts.",
    ],
    fields: [
      { name: "webhook_url", label: "Teams Webhook URL", type: "url", secret: true, required: true },
    ],
    direction: "outbound",
    ready: true,
    tags: ["messaging", "microsoft"],
  },
  {
    id: "email-resend",
    nameKey: "workspace.connectors.providers.email-resend.name",
    descriptionKey: "workspace.connectors.providers.email-resend.description",
    name: "Email (Resend)",
    description:
      "Deliver signal briefings by email using a Resend API key. Comes with a free tier that covers typical Ministry desk usage.",
    category: "comms",
    iconKey: "email",
    docsUrl: "https://resend.com/api-keys",
    setupSteps: [
      "Sign up at resend.com and verify your sending domain (or use onboarding@resend.dev for testing).",
      "Go to API Keys → Create. Pick 'Sending access only' and a descriptive name.",
      "Paste the API key below along with the From address and recipient list.",
    ],
    fields: [
      { name: "api_key", label: "Resend API key", placeholder: "re_...", type: "token", secret: true, required: true },
      { name: "from", label: "From address", placeholder: "signals@yourdomain.gov.ae", type: "text", required: true },
      { name: "to", label: "Recipient list (comma-separated)", type: "textarea", required: true },
    ],
    direction: "outbound",
    ready: true,
    tags: ["email"],
  },
  {
    id: "whatsapp-meta",
    nameKey: "workspace.connectors.providers.whatsapp-meta.name",
    descriptionKey: "workspace.connectors.providers.whatsapp-meta.description",
    name: "WhatsApp Business",
    description:
      "Send critical-severity alerts via Meta's WhatsApp Business API. Requires an approved business account and template.",
    category: "comms",
    iconKey: "whatsapp",
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
    setupSteps: [
      "Create a Meta Business account and register a WhatsApp Business phone number.",
      "In Meta Business Settings → System Users, create a system user and generate a permanent token.",
      "Submit your message template for approval (e.g. 'investuae_signal_alert').",
      "Paste the phone number id, token, and template name below.",
    ],
    fields: [
      { name: "phone_number_id", label: "Phone number ID", type: "text", required: true },
      { name: "access_token", label: "Permanent access token", type: "token", secret: true, required: true },
      { name: "template_name", label: "Approved template name", type: "text", required: true },
      { name: "recipients", label: "Recipient numbers (E.164, comma-separated)", type: "textarea", required: true },
    ],
    direction: "outbound",
    ready: true,
    tags: ["messaging"],
  },
  {
    id: "google-chat",
    nameKey: "workspace.connectors.providers.google-chat.name",
    descriptionKey: "workspace.connectors.providers.google-chat.description",
    name: "Google Chat",
    description:
      "Post matched signals into a Google Chat space via an Incoming Webhook. Works with any Workspace tenant — no OAuth, no app install.",
    category: "comms",
    iconKey: "google-chat",
    docsUrl: "https://developers.google.com/chat/how-tos/webhooks",
    setupSteps: [
      "In Google Chat, open the target space → space name → Apps & integrations → Webhooks.",
      "Add webhook, give it a name (e.g. InvestUAE Signals) and optional avatar.",
      "Copy the webhook URL — starts with https://chat.googleapis.com/v1/spaces/…/messages?key=…&token=…",
      "Paste it below. We'll format signals as Chat card messages.",
    ],
    fields: [
      { name: "webhook_url", label: "Google Chat Webhook URL", type: "url", secret: true, required: true },
    ],
    direction: "outbound",
    ready: true,
    tags: ["messaging", "google"],
  },

  // ── Automation platforms ─────────────────────────────────────────
  {
    id: "webhook-generic",
    nameKey: "workspace.connectors.providers.webhook-generic.name",
    descriptionKey: "workspace.connectors.providers.webhook-generic.description",
    name: "Custom Webhook",
    description:
      "Forward every matched signal to any HTTPS endpoint. Works with internal systems, Azure Logic Apps, AWS EventBridge, or any REST receiver.",
    category: "automation",
    iconKey: "webhook",
    docsUrl: "https://en.wikipedia.org/wiki/Webhook",
    setupSteps: [
      "Build or choose an HTTPS endpoint that accepts JSON POSTs.",
      "Optionally include a shared secret header for authentication.",
      "Paste the URL below. We'll send POST with Content-Type: application/json.",
    ],
    fields: [
      { name: "webhook_url", label: "Webhook URL (https://…)", type: "url", secret: true, required: true },
      { name: "auth_header_name", label: "Auth header name (optional)", placeholder: "X-API-Key", type: "text" },
      { name: "auth_header_value", label: "Auth header value (optional)", type: "token", secret: true },
    ],
    direction: "outbound",
    ready: true,
    tags: ["integration"],
  },
  {
    id: "power-automate",
    nameKey: "workspace.connectors.providers.power-automate.name",
    descriptionKey: "workspace.connectors.providers.power-automate.description",
    name: "Power Automate",
    description:
      "Trigger Microsoft Power Automate flows with every matched signal. Ideal for routing alerts into SharePoint, Dynamics, or Azure DevOps.",
    category: "automation",
    iconKey: "power-automate",
    docsUrl: "https://learn.microsoft.com/en-us/power-automate/triggers-introduction#when-an-http-request-is-received",
    setupSteps: [
      "In Power Automate, create an Automated flow with 'When an HTTP request is received' as the trigger.",
      "Save the flow and copy the generated HTTP POST URL.",
      "Paste it below. We'll POST one signal per event.",
    ],
    fields: [
      { name: "webhook_url", label: "Power Automate HTTP trigger URL", type: "url", secret: true, required: true },
    ],
    direction: "outbound",
    ready: true,
    tags: ["automation", "microsoft"],
  },
  {
    id: "zapier",
    nameKey: "workspace.connectors.providers.zapier.name",
    descriptionKey: "workspace.connectors.providers.zapier.description",
    name: "Zapier",
    description:
      "Connect matched signals to 6,000+ apps via a Zapier Catch Hook trigger.",
    category: "automation",
    iconKey: "zapier",
    docsUrl: "https://zapier.com/apps/webhook/integrations",
    setupSteps: [
      "In Zapier, create a new Zap. Pick Webhooks by Zapier → Catch Hook.",
      "Zapier shows a 'Custom Webhook URL'. Copy it.",
      "Paste it below. Run a test signal, then map fields to the downstream app.",
    ],
    fields: [
      { name: "webhook_url", label: "Zapier Catch Hook URL", type: "url", secret: true, required: true },
    ],
    direction: "outbound",
    ready: true,
    tags: ["automation"],
  },
  {
    id: "make",
    nameKey: "workspace.connectors.providers.make.name",
    descriptionKey: "workspace.connectors.providers.make.description",
    name: "Make (Integromat)",
    description:
      "Forward signals into Make scenarios for advanced routing, data-shaping, or multi-step workflows.",
    category: "automation",
    iconKey: "make",
    docsUrl: "https://www.make.com/en/help/tools/webhooks",
    setupSteps: [
      "In Make, start a scenario with Webhooks → Custom webhook.",
      "Add → copy the generated URL.",
      "Paste it below. Send a test, then complete the structure mapping.",
    ],
    fields: [
      { name: "webhook_url", label: "Make custom webhook URL", type: "url", secret: true, required: true },
    ],
    direction: "outbound",
    ready: true,
    tags: ["automation"],
  },
  {
    id: "n8n",
    nameKey: "workspace.connectors.providers.n8n.name",
    descriptionKey: "workspace.connectors.providers.n8n.description",
    name: "n8n",
    description:
      "Trigger n8n workflows with every matched signal. Works with n8n.cloud or any self-hosted instance — just paste the Webhook node URL.",
    category: "automation",
    iconKey: "n8n",
    docsUrl: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/",
    setupSteps: [
      "In n8n, create a new workflow starting with a Webhook node.",
      "Set HTTP Method to POST and Authentication to 'Header Auth' if you want a shared secret (optional).",
      "Activate the workflow, then copy the Production Webhook URL (not the Test URL).",
      "Paste it below. We'll POST one signal per event as JSON.",
    ],
    fields: [
      { name: "webhook_url", label: "n8n Production Webhook URL", type: "url", secret: true, required: true },
      { name: "auth_header_name", label: "Auth header name (optional)", placeholder: "X-N8N-Key", type: "text" },
      { name: "auth_header_value", label: "Auth header value (optional)", type: "token", secret: true },
    ],
    direction: "outbound",
    ready: true,
    tags: ["automation", "self-hosted"],
  },
  {
    id: "azure-logic-apps",
    nameKey: "workspace.connectors.providers.azure-logic-apps.name",
    descriptionKey: "workspace.connectors.providers.azure-logic-apps.description",
    name: "Azure Logic Apps",
    description:
      "Trigger an Azure Logic App whenever a signal matches. Ideal for Ministry flows that hand off to SharePoint, Dynamics 365, or Azure Service Bus.",
    category: "automation",
    iconKey: "azure-logic-apps",
    docsUrl: "https://learn.microsoft.com/en-us/azure/connectors/connectors-native-reqres",
    setupSteps: [
      "In the Azure portal, create a new Logic App with 'When a HTTP request is received' as the trigger.",
      "Save the Logic App — Azure will generate the HTTPS POST URL with a SAS signature.",
      "Copy the URL from the trigger's 'HTTP POST URL' field.",
      "Paste it below. We'll POST each matched signal as JSON.",
    ],
    fields: [
      { name: "webhook_url", label: "Logic App HTTP trigger URL", type: "url", secret: true, required: true },
    ],
    direction: "outbound",
    ready: true,
    tags: ["automation", "microsoft", "azure"],
  },
  {
    id: "azure-devops",
    nameKey: "workspace.connectors.providers.azure-devops.name",
    descriptionKey: "workspace.connectors.providers.azure-devops.description",
    name: "Azure DevOps",
    description:
      "Create Azure DevOps work items (tasks, bugs, custom types) for every matched signal. Uses a Personal Access Token scoped to Work Items: Read & write.",
    category: "automation",
    iconKey: "azure-devops",
    docsUrl: "https://learn.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/pats",
    setupSteps: [
      "In Azure DevOps, open User settings → Personal access tokens → New Token.",
      "Scope: 'Work Items (Read & write)'. Set a sensible expiry.",
      "Copy the token — you cannot view it again later.",
      "Paste the organization, project, token, and work item type below.",
    ],
    fields: [
      { name: "organization", label: "Organization", placeholder: "your-org (from dev.azure.com/your-org)", type: "text", required: true },
      { name: "project", label: "Project name", placeholder: "InvestUAE", type: "text", required: true },
      { name: "pat", label: "Personal access token", type: "token", secret: true, required: true },
      { name: "work_item_type", label: "Work item type", placeholder: "Task", type: "text" },
    ],
    direction: "outbound",
    ready: true,
    tags: ["automation", "microsoft", "azure"],
  },

  // ── Data sources ─────────────────────────────────────────────────
  {
    id: "airtable",
    nameKey: "workspace.connectors.providers.airtable.name",
    descriptionKey: "workspace.connectors.providers.airtable.description",
    name: "Airtable",
    description:
      "Append signals to an Airtable base. Read watchlist items from another table in the same base.",
    category: "datasource",
    iconKey: "airtable",
    docsUrl: "https://airtable.com/developers/web/api/introduction",
    setupSteps: [
      "In Airtable, go to Account → Developer hub → Personal access tokens.",
      "Create a token with scopes data.records:read, data.records:write, schema.bases:read on your target base.",
      "Copy the token and the Base ID (shown in the base URL after /app).",
      "Paste both below plus the table name.",
    ],
    fields: [
      { name: "api_key", label: "Personal access token", placeholder: "pat...", type: "token", secret: true, required: true },
      { name: "base_id", label: "Base ID", placeholder: "appXXXXXXXXXXXXXX", type: "text", required: true },
      { name: "signals_table", label: "Signals table name", placeholder: "Signals", type: "text" },
    ],
    direction: "bidirectional",
    ready: true,
    tags: ["spreadsheet", "database"],
  },
  {
    id: "notion-api",
    nameKey: "workspace.connectors.providers.notion-api.name",
    descriptionKey: "workspace.connectors.providers.notion-api.description",
    name: "Notion",
    description:
      "Push signal summaries into a Notion database. Read-only access to Ministry workspace documents is optional.",
    category: "datasource",
    iconKey: "notion",
    docsUrl: "https://developers.notion.com/docs/create-a-notion-integration",
    setupSteps: [
      "Visit notion.so/profile/integrations and create an Internal Integration.",
      "Copy the 'Internal Integration Token' (starts with secret_…).",
      "Open the target Notion database, click ⋯ → Connections → add your integration so it has access.",
      "Paste the token and database ID below.",
    ],
    fields: [
      { name: "api_key", label: "Integration token", placeholder: "secret_...", type: "token", secret: true, required: true },
      { name: "database_id", label: "Database ID", type: "text", required: true },
    ],
    direction: "bidirectional",
    ready: true,
    tags: ["knowledge-base"],
  },
  {
    id: "mcp-endpoint",
    nameKey: "workspace.connectors.providers.mcp-endpoint.name",
    descriptionKey: "workspace.connectors.providers.mcp-endpoint.description",
    name: "MCP Server (custom)",
    description:
      "Connect any Model Context Protocol server via streamable HTTP. Ministry-hosted or third-party.",
    category: "datasource",
    iconKey: "mcp",
    docsUrl: "https://modelcontextprotocol.io/introduction",
    setupSteps: [
      "Point this at any MCP server that implements the streamable HTTP transport.",
      "Optional: a bearer token if the server requires authentication.",
    ],
    fields: [
      { name: "endpoint_url", label: "MCP endpoint URL (/mcp)", type: "url", required: true },
      { name: "auth_token", label: "Bearer token (optional)", type: "token", secret: true },
      { name: "scope", label: "Scope label", placeholder: "e.g. adgm-filings", type: "text" },
    ],
    direction: "inbound",
    ready: true,
    tags: ["mcp"],
  },
];

export function getConnector(id: string): ConnectorSpec | undefined {
  return CONNECTORS.find((c) => c.id === id);
}

export function listConnectorsByCategory(): Record<string, ConnectorSpec[]> {
  const grouped: Record<string, ConnectorSpec[]> = {};
  for (const c of CONNECTORS) {
    (grouped[c.category] ||= []).push(c);
  }
  return grouped;
}
