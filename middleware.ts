import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { RESERVED_SUBDOMAINS } from "@/lib/site-url";

export async function middleware(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const appHost = (process.env.NEXT_PUBLIC_SITE_URL ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .toLowerCase();

  const isPlatformHost =
    !host ||
    !appHost ||
    host === appHost ||
    host === `www.${appHost}` ||
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.endsWith(".vercel.app");

  if (!isPlatformHost) {
    const url = request.nextUrl.clone();

    // Platform routes must keep working on every host. Without this,
    // /api/submit on a subdomain would be rewritten into the site path
    // and forms plus payments would break.
    const isPlatformRoute =
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/_next/") ||
      url.pathname === "/sw.js" ||
      url.pathname === "/favicon.ico";

    // ---- Site subdomains: <slug>.lypo.dev serves that published site ----
    if (host.endsWith(`.${appHost}`)) {
      const sub = host.slice(0, -(appHost.length + 1));
      // Single label only, so a.b.lypo.dev is not treated as a slug
      if (
        sub &&
        !sub.includes(".") &&
        !RESERVED_SUBDOMAINS.has(sub) &&
        !isPlatformRoute
      ) {
        // "/" -> /s/<slug>, "/about" -> /s/<slug>/about
        const path = url.pathname === "/" ? "" : url.pathname;
        url.pathname = `/s/${sub}${path}`;
        return NextResponse.rewrite(url);
      }
    } else if (!isPlatformRoute) {
      // ---- Custom domains: serve the mapped site ----
      // The path is kept, so /menu reaches the menu page. Dropping it used
      // to send every URL to the home page, and the route it landed on
      // redirected to /s/<slug>, which this same branch rewrote straight
      // back here: an endless loop.
      const path = url.pathname === "/" ? "" : url.pathname;
      url.pathname = `/domain/${host}${path}`;
      return NextResponse.rewrite(url);
    }
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected =
    path.startsWith("/dashboard") || path.startsWith("/builder");

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
