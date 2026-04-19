// Auth.js v5 catch-all handler.
//
// All sign-in / callback / session / sign-out endpoints route through here.
// The actual config lives in lib/auth.ts so it can be imported from server
// components and middleware too.

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
