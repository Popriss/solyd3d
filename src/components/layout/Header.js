'use client';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Bell, LogOut, User as UserIcon, Shield } from 'lucide-react';

const pageNames = {
  '/': 'Dashboard',
  '/estoque': 'Controle de Estoque',
  '/produtos': 'Catálogo de Produtos',
  '/producao': 'Controle de Produção',
  '/financeiro': 'Gestão Financeira',
  '/configuracoes': 'Configurações',
  '/vendas/pontos': 'Comércios & Bancas',
  '/vendas': 'Remessas & Acertos',
};

export default function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const pageName = pageNames[pathname] || 'Solyd3D';

  return (
    <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div className="header-breadcrumb">
        Solyd3D / <span>{pageName}</span>
      </div>
      <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {session?.user && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--bg-secondary)', padding: '6px 12px', borderRadius: 20, border: '1px solid var(--border-primary)'
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-indigo)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
            }}>
              <UserIcon size={14} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.1 }}>
                {session.user.name || session.user.email}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <Shield size={10} /> Admin
              </span>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="btn btn-ghost btn-sm btn-icon"
              title="Sair do Sistema"
              style={{ marginLeft: 4, color: 'var(--accent-rose)' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        )}

        <button className="btn btn-ghost btn-icon" title="Notificações">
          <Bell size={18} />
        </button>
      </div>
    </header>
  );
}
