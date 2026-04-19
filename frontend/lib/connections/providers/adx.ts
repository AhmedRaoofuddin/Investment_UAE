// ADX (Abu Dhabi Securities Exchange) market data — UAE-native trading
// platform connection.
//
// ADX exposes historical + intraday market data via its data licensing
// programme. For the pilot this provider is API-key based: institutional
// users paste their ADX-issued data API key, we validate format only and
// store it in the encrypted vault. A nightly Inngest job pulls the
// portfolio symbols from the user's watchlist.
//
// We deliberately do NOT proxy live tick data through our backend (that
// would put us in scope for ADX market-data licensing as a redistributor).
// We only fetch end-of-day bars + corporate actions.

import type { ConnectionProvider } from "../types";

export const adxProvider: ConnectionProvider = {
  meta: {
    id: "adx",
    kind: "API_KEY",
    name: "ADX: Abu Dhabi Securities Exchange",
    description:
      "End-of-day bars + corporate actions for symbols on your watchlist. Bring your own ADX data API key.",
    iconKey: "adx",
    tiers: ["VERIFIED", "INSTITUTION"],
    docsUrl: "https://www.adx.ae",
    ready: true,
  },
  async validateApiKey(key: string) {
    if (key.length < 16) {
      return { ok: false, error: "ADX keys are at least 16 characters" };
    }
    return { ok: true };
  },
};
