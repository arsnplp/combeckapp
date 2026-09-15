import { NextRequest, NextResponse } from "next/server";
import { deleteEmployeeSession } from "@/lib/employee-sessions";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("comeback_staff")?.value;
  if (token) await deleteEmployeeSession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("comeback_staff", "", { maxAge: 0, path: "/" });
  return res;
}
