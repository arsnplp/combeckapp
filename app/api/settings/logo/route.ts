import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const LOGO_PATH = path.join(process.cwd(), "data", "logo.png");

export async function GET() {
  if (!existsSync(LOGO_PATH)) {
    return new NextResponse(null, { status: 404 });
  }
  const file = readFileSync(LOGO_PATH);
  return new NextResponse(file, {
    headers: { "Content-Type": "image/png", "Cache-Control": "no-cache" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { data } = await req.json() as { data: string };
    if (!data?.startsWith("data:image/")) {
      return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
    }
    const base64 = data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    mkdirSync(path.dirname(LOGO_PATH), { recursive: true });
    writeFileSync(LOGO_PATH, buffer);
    return NextResponse.json({ ok: true, url: "/api/settings/logo" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
