import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'E-mail', type: 'email', placeholder: 'admin@solyd3d.com' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('E-mail e senha são obrigatórios.');
        }

        const email = credentials.email.toLowerCase().trim();

        // Verificar se já existe algum usuário no banco de dados
        const usersCount = await prisma.user.count();

        // SE O BANCO ESTIVER VAZIO e o usuário tentar entrar com admin@solyd3d.com / Admin@123:
        // Criamos o primeiro usuário administrador automaticamente (Opção A)
        if (usersCount === 0 && email === 'admin@solyd3d.com' && credentials.password === 'Admin@123') {
          const passwordHash = await bcrypt.hash('Admin@123', 10);
          const newAdmin = await prisma.user.create({
            data: {
              name: 'Administrador Solyd3D',
              email: 'admin@solyd3d.com',
              passwordHash,
              role: 'ADMIN',
            },
          });
          return {
            id: newAdmin.id,
            name: newAdmin.name,
            email: newAdmin.email,
            role: newAdmin.role,
          };
        }

        // Caso o banco já tenha usuários ou não seja o login padrão de inicialização:
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          throw new Error('Usuário não encontrado ou credenciais inválidas.');
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error('Senha incorreta.');
        }

        if (user.role !== 'ADMIN') {
          throw new Error('Acesso restrito apenas para administradores do sistema.');
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET || 'fallback-secret-for-development-solyd3d',
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
