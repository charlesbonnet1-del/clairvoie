import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/config";

export async function POST(req: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
