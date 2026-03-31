import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const rol = String((req.nextauth.token as { rol?: string })?.rol || "").toLowerCase();

    if (pathname.startsWith("/admin") && rol !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    if (
      rol === "user" &&
      (pathname.startsWith("/envios") || pathname.startsWith("/reporte") || pathname.startsWith("/usuarios"))
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
};
