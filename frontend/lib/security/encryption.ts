// AES-256-GCM token vault.
//
// Third-party OAuth access/refresh tokens, API keys, and webhook secrets are
// encrypted with a per-tenant data encryption key (DEK). The DEK is derived
// from TOKEN_VAULT_MASTER_KEY via HKDF-SHA256 with the tenant id as salt, so
// a dump of the Connection/ConnectionSecret tables alone is useless without
// the master key, and a compromise of one tenant's DEK doesn't leak others.
//
// In production TOKEN_VAULT_MASTER_KEY lives in KMS (Azure Key Vault when we
// migrate). For the pilot it's a 32-byte random value in Vercel env.

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LEN = 32; // 256 bits
const IV_LEN = 12; // 96 bits, standard for GCM
const AUTH_TAG_LEN = 16; // 128 bits

function masterKey(): Buffer {
  const raw = process.env.TOKEN_VAULT_MASTER_KEY;
  if (!raw) {
    throw new Error(
      "TOKEN_VAULT_MASTER_KEY not set. Generate with " +
        "`node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"` " +
        "and add to Vercel env before using the vault.",
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== KEY_LEN) {
    throw new Error(
      `TOKEN_VAULT_MASTER_KEY must decode to ${KEY_LEN} bytes (got ${buf.length}).`,
    );
  }
  return buf;
}

// Per-tenant data encryption key. HKDF ensures two tenants with the same
// master key get unrelated DEKs; compromise of one tenant's ciphertext can't
// be decrypted with a different tenant's id even if the master is leaked
// later for only that tenant. The `info` parameter binds the DEK to a usage
// context (currently "connection-secret") so we can rotate kinds independently.
function deriveDek(tenantId: string, info = "connection-secret"): Buffer {
  const salt = Buffer.from(tenantId, "utf8");
  const dek = hkdfSync("sha256", masterKey(), salt, Buffer.from(info), KEY_LEN);
  return Buffer.from(dek);
}

export interface SealedSecret {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

export function sealSecret(tenantId: string, plaintext: string): SealedSecret {
  const dek = deriveDek(tenantId);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, dek, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

export function openSecret(tenantId: string, sealed: SealedSecret): string {
  if (sealed.authTag.length !== AUTH_TAG_LEN) {
    throw new Error("Invalid auth tag length");
  }
  const dek = deriveDek(tenantId);
  const decipher = createDecipheriv(ALGORITHM, dek, sealed.iv);
  decipher.setAuthTag(sealed.authTag);
  const plaintext = Buffer.concat([
    decipher.update(sealed.ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

// Convenience for API-key-style single-value secrets stored in env.
// Not for tenant-scoped data — use sealSecret for that.
export function redact(value: string | undefined, keep = 4): string {
  if (!value) return "(unset)";
  if (value.length <= keep * 2) return "*".repeat(value.length);
  return value.slice(0, keep) + "…" + value.slice(-keep);
}
