'use client';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function AppLayoutClient({ children }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <main className="login-wrapper">{children}</main>;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <Header />
      <main className="main-content">{children}</main>
    </div>
  );
}
