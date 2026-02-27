import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const user = req.cookies.get("nh_user");
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/sectors/:path*"],
};
