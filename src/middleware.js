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

        // Acesso restrito apenas para Administradores na rota e API de Usuários (/usuarios e /api/users)
        if (req.nextUrl.pathname.startsWith('/usuarios') || req.nextUrl.pathname.startsWith('/api/users')) {
          return !!token && token.role === 'ADMIN';
        }

        // Para todas as outras rotas do ERP, permitir acesso para qualquer usuário logado (USER ou ADMIN)
        return !!token;
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
