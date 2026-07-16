'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard, Package, Boxes, Factory, DollarSign,
  Settings, Printer, Store, ShoppingBag, Users, ShoppingCart, Calculator
} from 'lucide-react';

const navItems = [
  { section: 'Principal' },
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { section: 'Comercial' },
  { href: '/vendas/pontos', label: 'Comércios / Bancas', icon: Store },
  { href: '/vendas', label: 'Remessas / Acertos', icon: ShoppingBag },
  { section: 'Operações' },
  { href: '/calculadora', label: 'Calculadora de Impressão', icon: Calculator },
  { href: '/estoque', label: 'Estoque de Insumos', icon: Boxes },
  { href: '/produtos', label: 'Catálogo de Peças', icon: Package },
  { href: '/producao', label: 'Produção', icon: Factory },
  { section: 'Financeiro' },
  { href: '/financeiro', label: 'Financeiro', icon: DollarSign },
  { href: '/compras', label: 'Compras & Despesas', icon: ShoppingCart },
  { section: 'Sistema' },
  { href: '/usuarios', label: 'Usuários & Acessos', icon: Users, adminOnly: true },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon"><Printer size={20} /></div>
        <span className="sidebar-logo-text">Solyd3D</span>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item, i) => {
          if (item.section) {
            return <div key={i} className="sidebar-section-title">{item.section}</div>;
          }
          if (item.adminOnly && !isAdmin) {
            return null;
          }
          const Icon = item.icon;
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon /> {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
