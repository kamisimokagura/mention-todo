import { NextRequest, NextResponse } from "next/server";
import { getBasicCredentials } from "@/lib/auth";

function unauthorizedResponse() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Mention TODO", charset="UTF-8"',
    },
  });
}

function decodeBasicAuth(authHeader: string): { username: string; password: string } | null {
  if (!authHeader.startsWith("Basic ")) return null;

  try {
    const base64Part = authHeader.slice(6);
    const decoded = atob(base64Part);
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function isExcludedPath(pathname: string): boolean {
  if (pathname.startsWith("/api/integrations/discord/webhook")) return true;
  if (pathname.startsWith("/api/integrations/gmail/callback")) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const credentials = getBasicCredentials();
  if (!credentials) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (isExcludedPath(pathname)) return NextResponse.next();

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return unauthorizedResponse();

  const parsed = decodeBasicAuth(authHeader);
  if (!parsed) return unauthorizedResponse();

  if (
    parsed.username !== credentials.username ||
    parsed.password !== credentials.password
  ) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

