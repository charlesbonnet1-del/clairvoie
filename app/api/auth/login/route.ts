import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSessionToken, roleHome, verifyPassword } from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/config";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const identity = await prisma.identity.findUnique({ where: { email } });
  if (!identity || !(await verifyPassword(password, identity.passwordHash))) {
    return NextResponse.redirect(new URL("/login?error=1", req.url), { status: 303 });
  }

  const token = createSessionToken(identity.id);
  const response = NextResponse.redirect(new URL(roleHome(identity.role), req.url), {
    status: 303,
  });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
