import './globals.css';
import AuthProvider from '@/components/auth/AuthProvider';
import AppLayoutClient from '@/components/layout/AppLayoutClient';

export const metadata = {
  title: 'Solyd3D — Mini-ERP para Impressão 3D',
  description: 'Sistema de gestão financeira, estoque e produção para impressão 3D',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>
          <AppLayoutClient>{children}</AppLayoutClient>
        </AuthProvider>
      </body>
    </html>
  );
}
