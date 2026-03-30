import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const rol = String((req.nextauth.token as { rol?: string })?.rol || "").toLowerCase();

    if (pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    const userBlocked = ["/entregas", "/legalizaciones", "/balance", "/envios", "/usuarios", "/informes"];
    if (rol === "user" && userBlocked.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    const roleRoutes: [string, string[]][] = [
      ["/envios", ["admin"]],
      ["/informes/crear", ["admin", "verificador"]],
      ["/informes", ["admin", "verificador"]],
      ["/balance", ["admin", "coordinador"]],
      ["/entregas", ["admin", "coordinador"]],
      ["/legalizaciones", ["admin", "coordinador"]],
      ["/usuarios", ["admin"]],
    ];

    for (const [route, roles] of roleRoutes) {
      if (pathname.startsWith(route) && !roles.includes(rol)) {
        return NextResponse.redirect(new URL("/", req.url));
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
