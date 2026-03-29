import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const rol = String((req.nextauth.token as { rol?: string })?.rol || "").toLowerCase();

    const roleRoutes: [string, string[]][] = [
      ["/envios", ["admin", "coordinador"]],
      ["/informes/crear", ["admin", "coordinador", "verificador"]],
      ["/informes", ["admin", "coordinador", "verificador"]],
      ["/balance", ["coordinador"]],
    ];

    for (const [route, roles] of roleRoutes) {
      if (pathname.startsWith(route) && !roles.includes(rol)) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
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
