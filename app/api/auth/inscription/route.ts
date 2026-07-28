import { NextRequest, NextResponse } from "next/server";
import { inscrireParent } from "@/lib/parentAuth";
import { RegleMetierError } from "@/lib/tickets";
import { createSessionToken } from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/config";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const telephone = String(formData.get("telephone") ?? "").trim();

  if (!displayName || !email || !password || !telephone) {
    return NextResponse.redirect(new URL("/inscription?error=champs_manquants", req.url), {
      status: 303,
    });
  }

  try {
    const { identityId } = await inscrireParent({ displayName, email, password, telephone });

    const token = createSessionToken(identityId);
    const response = NextResponse.redirect(new URL("/verification-compte?success=inscription", req.url), {
      status: 303,
    });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (err) {
    if (err instanceof RegleMetierError) {
      return NextResponse.redirect(
        new URL(`/inscription?error=${encodeURIComponent(err.message)}`, req.url),
        { status: 303 }
      );
    }
    throw err;
  }
}
