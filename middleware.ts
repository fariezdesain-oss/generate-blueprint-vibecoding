import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/db/supabaseAdminClient';

const protectedRoutes = ['/chat', '/history', '/settings'];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  if (user && isProtected) {
    try {
      const adminClient = createAdminClient();
      const { data: profile } = await adminClient
        .from('profiles')
        .select('last_activity_at')
        .eq('id', user.id)
        .single();

      const THIRTY_MIN_MS = 30 * 60 * 1000;
      const lastActivity = profile?.last_activity_at
        ? new Date(profile.last_activity_at as string).getTime()
        : Date.now(); // Jika null, anggap baru aktif (mencegah user baru ter-kick langsung)
      const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;

      const mostRecentActivity = Math.max(lastActivity, lastSignIn);

      if (Date.now() - mostRecentActivity > THIRTY_MIN_MS) {
        await adminClient.auth.admin.signOut(user.id);
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        const response = NextResponse.redirect(url);

        // Hapus cookie sesi dari browser agar tidak terjadi infinite redirect loop
        request.cookies.getAll().forEach((cookie) => {
          if (cookie.name.startsWith('sb-')) {
            response.cookies.delete(cookie.name);
          }
        });

        return response;
      }
    } catch (e) {
      console.error('Middleware auth check error:', e);
      // Fallback: allow the request through so the app doesn't hang
    }
  }

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && (pathname === '/login' || pathname === '/register')) {
    const url = request.nextUrl.clone();
    url.pathname = '/chat';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
