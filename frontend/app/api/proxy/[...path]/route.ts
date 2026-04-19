import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

async function proxy(req: NextRequest, segments: string[]) {
  const upstream = new URL(`${BACKEND}/${segments.join("/")}`);
  req.nextUrl.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));

  const init: RequestInit = {
    method: req.method,
    headers: { "Accept": "application/json" },
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
    (init.headers as Record<string, string>)["Content-Type"] =
      req.headers.get("content-type") ?? "application/json";
  }

  try {
    const res = await fetch(upstream, init);
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "backend_unreachable", detail: String(err) },
      { status: 502 },
    );
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, (await ctx.params).path);
}
