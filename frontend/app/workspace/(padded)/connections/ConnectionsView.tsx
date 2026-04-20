"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Check, ExternalLink, Lock, Plus, Shield, X } from "lucide-react";
import type { ConnectorSpec } from "@/lib/connections/catalogue";
import { Eyebrow, SerifHeading, Card, CardBody, Badge } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/LocaleProvider";

interface SavedConnection {
  id: string;
  provider: string;
  status: string;
  label: string | null;
  config: Record<string, string>;
  updatedAt: string;
  lastError: string | null;
}

const CATEGORY_ORDER: ConnectorSpec["category"][] = [
  "analytics",
  "comms",
  "automation",
  "datasource",
  "destination",
];

const CATEGORY_META: Record<
  ConnectorSpec["category"],
  { tKey: string; fallback: string; description: string }
> = {
  analytics: {
    tKey: "workspace.connectors.cat.analytics",
    fallback: "Analytics & BI",
    description: "Stream signals into dashboards and reporting tools.",
  },
  comms: {
    tKey: "workspace.connectors.cat.comms",
    fallback: "Alert channels",
    description: "Route matched signals to Ministry messaging.",
  },
  automation: {
    tKey: "workspace.connectors.cat.automation",
    fallback: "Automation",
    description: "Trigger workflows whenever new signals land.",
  },
  datasource: {
    tKey: "workspace.connectors.cat.datasource",
    fallback: "Data sources",
    description: "Two-way read/write with your existing systems.",
  },
  destination: {
    tKey: "workspace.connectors.cat.destination",
    fallback: "Other destinations",
    description: "",
  },
};

export function ConnectionsView({
  connectors,
  saved,
}: {
  connectors: ConnectorSpec[];
  saved: SavedConnection[];
}) {
  const { t } = useLocale();
  const [modalConnector, setModalConnector] = useState<ConnectorSpec | null>(null);

  const byCategory = useMemo(() => {
    const map: Record<string, ConnectorSpec[]> = {};
    for (const c of connectors) {
      (map[c.category] ||= []).push(c);
    }
    return map;
  }, [connectors]);

  const savedByProvider = useMemo(() => {
    const m = new Map<string, SavedConnection>();
    for (const s of saved) m.set(s.provider, s);
    return m;
  }, [saved]);

  return (
    <>
      <div className="mb-6 md:mb-8 flex items-start justify-between flex-wrap gap-4">
        <div className="max-w-2xl">
          <Eyebrow>{t("workspace.nav.connections")}</Eyebrow>
          <SerifHeading level={1} className="mt-2">
            {t("workspace.connectors.title", "Connect the systems the Ministry already runs on.")}
          </SerifHeading>
          <p className="mt-2 text-ink-500 leading-relaxed">
            {t(
              "workspace.connectors.subtitle",
              "Paste an API key or webhook URL from any of the tools below. All credentials are sealed at rest with AES-256-GCM using a per-tenant key, never shared across workspaces, and hard-deleted the moment you disconnect.",
            )}
          </p>
        </div>
        <SecurityPill />
      </div>

      {saved.length > 0 && (
        <Card className="mb-8 bg-sand-50">
          <CardBody className="p-5 flex items-center gap-3 flex-wrap">
            <Check className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="text-sm text-navy-800">
              <strong>{saved.length}</strong>{" "}
              {saved.length === 1
                ? t("workspace.connectors.activeOne", "active connection")
                : t("workspace.connectors.activeMany", "active connections")}
            </div>
            <span className="text-xs text-ink-500 ms-auto">
              {t(
                "workspace.connectors.auditHint",
                "Every save and revoke is written to the append-only audit log.",
              )}
            </span>
          </CardBody>
        </Card>
      )}

      <div className="space-y-10">
        {CATEGORY_ORDER.map((cat) => {
          const items = byCategory[cat];
          if (!items || items.length === 0) return null;
          const meta = CATEGORY_META[cat];
          return (
            <section key={cat}>
              <div className="mb-4">
                <h2 className="text-[11px] uppercase tracking-[0.24em] text-gold-600 font-semibold">
                  {t(meta.tKey, meta.fallback)}
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((c) => (
                  <ConnectorCard
                    key={c.id}
                    connector={c}
                    saved={savedByProvider.get(c.id)}
                    onConnect={() => setModalConnector(c)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {modalConnector && (
        <ConnectorModal
          connector={modalConnector}
          existing={savedByProvider.get(modalConnector.id)}
          onClose={() => setModalConnector(null)}
        />
      )}
    </>
  );
}

function SecurityPill() {
  const { t } = useLocale();
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-xs font-medium text-emerald-900">
      <Shield className="w-3.5 h-3.5" />
      {t("workspace.connectors.securityBadge", "AES-256-GCM · per-tenant DEK · audited")}
    </div>
  );
}

function ConnectorCard({
  connector,
  saved,
  onConnect,
}: {
  connector: ConnectorSpec;
  saved?: SavedConnection;
  onConnect: () => void;
}) {
  const { t } = useLocale();
  const isConnected = !!saved && saved.status === "ACTIVE";
  const hasError = !!saved && (saved.status === "ERROR" || !!saved.lastError);
  return (
    <Card
      className={cn(
        "h-full transition-colors",
        isConnected && "border-emerald-300 bg-emerald-50/30",
      )}
    >
      <CardBody className="p-5 flex flex-col h-full">
        <div className="flex items-start justify-between gap-3 mb-4">
          <ConnectorIcon iconKey={connector.iconKey} />
          <div className="flex items-center gap-1.5">
            {!connector.ready && (
              <Badge tone="default">
                {t("workspace.connectors.comingSoon", "Coming soon")}
              </Badge>
            )}
            {isConnected && (
              <Badge tone="success">
                {t("workspace.connectors.statusActive", "Connected")}
              </Badge>
            )}
            {hasError && (
              <Badge tone="danger">
                {t("workspace.connectors.statusError", "Needs attention")}
              </Badge>
            )}
          </div>
        </div>
        <h3 className="font-semibold text-navy-800 text-[15px] mb-1.5">
          {t(connector.nameKey ?? "", connector.name)}
        </h3>
        <p className="text-xs text-ink-500 leading-relaxed mb-4 flex-1">
          {t(connector.descriptionKey ?? "", connector.description)}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {connector.ready ? (
            <button
              onClick={onConnect}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 h-9 rounded-[3px] text-xs font-medium transition-colors",
                isConnected
                  ? "border border-line bg-white text-navy-700 hover:border-navy-300"
                  : "bg-navy-800 text-white hover:bg-navy-700",
              )}
            >
              {isConnected ? (
                <>
                  {t("workspace.connectors.manage", "Manage")}
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  {t("workspace.connectors.connect", "Connect")}
                </>
              )}
            </button>
          ) : (
            <button
              disabled
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-[3px] text-xs font-medium border border-line bg-sand-50 text-ink-400 cursor-not-allowed"
            >
              {t("workspace.connectors.comingSoon", "Coming soon")}
            </button>
          )}
          <a
            href={connector.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-navy-800"
          >
            <ExternalLink className="w-3 h-3 rtl:-scale-x-100" />
            {t("workspace.connectors.docs", "Docs")}
          </a>
        </div>
      </CardBody>
    </Card>
  );
}

function ConnectorModal({
  connector,
  existing,
  onClose,
}: {
  connector: ConnectorSpec;
  existing?: SavedConnection;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of connector.fields) {
      if (!f.secret && existing?.config?.[f.name]) {
        init[f.name] = existing.config[f.name];
      } else {
        init[f.name] = "";
      }
    }
    return init;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const isUpdate = !!existing;

  function validateFields(): string | null {
    // Required check — for updates, secret fields are optional (keep existing).
    for (const f of connector.fields) {
      if (!f.required) continue;
      const val = (values[f.name] ?? "").trim();
      if (!val && !(isUpdate && f.secret)) {
        return t("workspace.connectors.errMissing", "Please fill the required fields.");
      }
    }
    // URL format check — must be a valid https:// URL.
    for (const f of connector.fields) {
      if (f.type !== "url") continue;
      const val = (values[f.name] ?? "").trim();
      if (!val) continue;
      try {
        const parsed = new URL(val);
        if (parsed.protocol !== "https:") throw new Error("not https");
      } catch {
        return t(
          "workspace.connectors.errInvalidUrl",
          "One or more URL fields must be a valid HTTPS address (must start with https://).",
        );
      }
    }
    return null;
  }

  async function handleSave() {
    const validationErr = validateFields();
    if (validationErr) { setError(validationErr); return; }
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/workspace/connectors/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectorId: connector.id, fields: values }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(
          data.error === "missing_required_fields"
            ? t("workspace.connectors.errMissing", "Please fill the required fields.")
            : data.error === "invalid_url_fields"
              ? t("workspace.connectors.errInvalidUrl", "One or more URL fields must be a valid HTTPS address (must start with https://).")
              : data.error ?? t("workspace.connectors.errGeneric", "Something went wrong. Try again."),
        );
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch {
      setError(t("workspace.connectors.errNetwork", "Network error. Check your connection."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisconnect() {
    if (!existing) return;
    setSubmitting(true);
    try {
      await fetch(`/api/workspace/connectors/${existing.id}`, { method: "DELETE" });
      window.location.reload();
    } catch {
      setSubmitting(false);
      setConfirmDisconnect(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 end-3 p-1.5 rounded-full hover:bg-sand-100 text-ink-500"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 md:p-8">
          <div className="flex items-start gap-3 mb-5">
            <ConnectorIcon iconKey={connector.iconKey} />
            <div>
              <h3 className="headline-serif text-navy-800 text-2xl leading-tight">
                {t(connector.nameKey ?? "", connector.name)}
              </h3>
              <p className="text-xs text-ink-500 mt-1">
                {t(connector.descriptionKey ?? "", connector.description)}
              </p>
            </div>
          </div>

          {/* Manage banner — shown when updating an existing active connection */}
          {isUpdate && (
            <div className="mb-5 rounded-[3px] border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-2.5">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-900 space-y-0.5">
                <p className="font-semibold">
                  {t("workspace.connectors.statusActive", "Connected")}
                  {existing?.updatedAt && (
                    <> · {t("workspace.connectors.connectedSince", "Connected since")}{" "}
                    {new Date(existing.updatedAt).toLocaleDateString()}</>
                  )}
                </p>
                <p className="text-emerald-700">
                  {t("workspace.connectors.secretUpdateHint", "Leave any encrypted field blank to keep its current stored value.")}
                </p>
                {existing?.lastError && (
                  <p className="mt-1 text-red-700">
                    {t("workspace.connectors.lastError", "Last error")}: {existing.lastError}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Setup steps */}
          <div className="mb-5 rounded-[3px] border border-gold-100 bg-gold-50 p-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-gold-700 font-semibold mb-2">
              {t("workspace.connectors.setupSteps", "Setup steps")}
            </div>
            <ol className="space-y-1.5 text-sm text-navy-800 list-decimal ps-5">
              {connector.setupSteps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <a
              href={connector.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs text-gold-700 hover:text-gold-800"
            >
              <ExternalLink className="w-3 h-3 rtl:-scale-x-100" />
              {t("workspace.connectors.openVendorDocs", "Open vendor docs")}
            </a>
          </div>

          {/* Fields */}
          <div className="space-y-4">
            {connector.fields.map((field) => (
              <label key={field.name} className="block">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-medium text-navy-800">
                    {field.label}
                    {field.required && <span className="text-red-600 ms-1">*</span>}
                  </span>
                  {field.secret && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700">
                      <Lock className="w-3 h-3" />
                      {t("workspace.connectors.encrypted", "encrypted")}
                    </span>
                  )}
                </div>
                {field.type === "textarea" ? (
                  <textarea
                    value={values[field.name] ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [field.name]: e.target.value }))
                    }
                    placeholder={field.placeholder}
                    rows={3}
                    className="w-full px-3 py-2 text-sm rounded-[3px] border border-line bg-white focus:outline-none focus:border-navy-300 font-mono"
                  />
                ) : (
                  <input
                    type={field.secret ? "password" : "text"}
                    value={values[field.name] ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [field.name]: e.target.value }))
                    }
                    placeholder={
                      isUpdate && field.secret
                        ? "••••••••  (unchanged)"
                        : field.placeholder
                    }
                    className="w-full h-10 px-3 text-sm rounded-[3px] border border-line bg-white focus:outline-none focus:border-navy-300 font-mono"
                  />
                )}
                {field.help && (
                  <p className="mt-1 text-[11px] text-ink-500">{field.help}</p>
                )}
              </label>
            ))}
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-[3px] border border-red-200 bg-red-50 text-xs text-red-900">
              {error}
            </div>
          )}
          {success && (
            <div className="mt-4 p-3 rounded-[3px] border border-emerald-200 bg-emerald-50 text-xs text-emerald-900">
              {t("workspace.connectors.saved", "Saved. The connector is now active.")}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[11px] text-ink-400 flex items-center gap-1.5">
              <Shield className="w-3 h-3" />
              {t("workspace.connectors.modalSecurityHint", "Credentials never leave our server after encryption.")}
            </div>
            <div className="flex items-center gap-2">
              {existing && (
                <button
                  onClick={() => setConfirmDisconnect(true)}
                  disabled={submitting}
                  className="px-3 h-9 rounded-[3px] border border-red-200 bg-white text-red-700 text-xs font-medium hover:bg-red-50 disabled:opacity-50"
                >
                  {t("workspace.connectors.disconnect", "Disconnect")}
                </button>
              )}
              <button
                onClick={onClose}
                className="px-3 h-9 rounded-[3px] border border-line bg-white text-navy-700 text-xs font-medium hover:border-navy-300"
              >
                {t("workspace.connectors.cancel", "Cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={submitting}
                className="px-4 h-9 rounded-[3px] bg-gold-500 text-navy-900 text-xs font-semibold hover:bg-gold-400 disabled:opacity-50"
              >
                {submitting
                  ? t("workspace.connectors.saving", "Saving…")
                  : existing
                    ? t("workspace.connectors.update", "Update")
                    : t("workspace.connectors.saveConnect", "Save & connect")}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDisconnect}
        title={t("workspace.connectors.confirmRevokeTitle", "Disconnect this connector?")}
        body={t(
          "workspace.connectors.confirmRevoke",
          "Disconnect this connector? The encrypted key will be deleted immediately.",
        )}
        confirmLabel={t("workspace.connectors.disconnect", "Disconnect")}
        cancelLabel={t("workspace.connectors.cancel", "Cancel")}
        tone="danger"
        pending={submitting}
        onClose={() => !submitting && setConfirmDisconnect(false)}
        onConfirm={handleDisconnect}
      />
    </div>
  );
}

function ConnectorIcon({ iconKey }: { iconKey: string }) {
  // Local mapping of icon keys → /public/icons/connectors/*.svg. Falls
  // back to a Ministry-gold plug glyph for iconKeys we don't ship art
  // for yet.
  const local = `/icons/connectors/${iconKey}.svg`;
  return (
    <div className="w-11 h-11 rounded-[6px] border border-line bg-white flex items-center justify-center shrink-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element -- local svg, ok */}
      <img
        src={local}
        onError={(e) => {
          (e.target as HTMLImageElement).src = "/icons/ministry/connectivity.svg";
        }}
        alt=""
        aria-hidden="true"
        className="w-6 h-6 object-contain"
      />
    </div>
  );
}
