import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isLogin = req.nextUrl.pathname.startsWith('/login');

    // Se estiver logado e tentar acessar /login, redireciona para o Dashboard /
    if (isLogin && token) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const isLogin = req.nextUrl.pathname.startsWith('/login');
        const isApiAuth = req.nextUrl.pathname.startsWith('/api/auth');

        // Permitir acesso livre à tela de login e às rotas de autenticação
        if (isLogin || isApiAuth) return true;

        // Para todas as outras rotas (páginas do ERP e APIs de dados), exigir token com role ADMIN
        return !!token && token.role === 'ADMIN';
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Interceptar todas as rotas exceto arquivos estáticos de imagem, favicon, e CSS/JS do Next (_next)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
