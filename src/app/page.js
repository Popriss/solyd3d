'use client';
import { useState, useEffect } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Factory,
  AlertTriangle, Boxes, Package, XCircle, BarChart3, PieChart as PieIcon, Activity, History
} from 'lucide-react';
import { formatCurrency, formatWeight, formatDate } from '@/lib/formatters';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend
} from 'recharts';

// Custom Tooltip para os gráficos de moeda do Recharts
const CurrencyTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
        padding: '10px 14px', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
      }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
          {label}
        </div>
        {payload.map((entry, idx) => (
          <div key={idx} style={{ fontSize: '0.85rem', color: entry.color, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <span>{entry.name}:</span>
            <strong>{formatCurrency(entry.value)}</strong>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="spinner" style={{ width: 36, height: 36 }}></div>
      </div>
    );
  }

  const fin = data?.financial || {};
  const prod = data?.production || {};
  const inv = data?.inventory || {};
  const charts = data?.charts || { dailyRevenue: [], topProducts: [], costBreakdown: [] };
  const recentLogs = data?.recentLogs || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Operacional & Financeiro</h1>
          <p className="page-subtitle">Visão executiva em tempo real com inteligência comercial e custeio 3D</p>
        </div>
      </div>

      {/* Financial Stats */}
      <div className="stats-grid">
        <div className="stat-card emerald">
          <div className="stat-card-header">
            <div className="stat-card-icon emerald"><TrendingUp size={20} /></div>
          </div>
          <div className="stat-card-label">Receita Real das Bancas</div>
          <div className="stat-card-value">{formatCurrency(fin.totalRevenue || 0)}</div>
        </div>
        <div className="stat-card rose">
          <div className="stat-card-header">
            <div className="stat-card-icon rose"><TrendingDown size={20} /></div>
          </div>
          <div className="stat-card-label">Saídas & Custos Total</div>
          <div className="stat-card-value">{formatCurrency(fin.totalMonthlyCost || 0)}</div>
        </div>
        <div className="stat-card indigo">
          <div className="stat-card-header">
            <div className="stat-card-icon indigo"><DollarSign size={20} /></div>
          </div>
          <div className="stat-card-label">Lucro Líquido Limpo</div>
          <div className="stat-card-value" style={{ color: (fin.estimatedNetProfit || 0) >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
            {formatCurrency(fin.estimatedNetProfit || 0)}
          </div>
        </div>
        <div className="stat-card amber">
          <div className="stat-card-header">
            <div className="stat-card-icon amber"><XCircle size={20} /></div>
          </div>
          <div className="stat-card-label">Prejuízo em Falhas / Perdas</div>
          <div className="stat-card-value">{formatCurrency(fin.failureCost || 0)}</div>
        </div>
      </div>

      {/* SECÇÃO GRÁFICOS INTERATIVOS RECHARTS */}
      <div className="grid-2" style={{ marginTop: 24, marginBottom: 24 }}>
        {/* GRÁFICO 1: Curva de Evolução da Receita vs Custo (AreaChart) */}
        <div className="card" style={{ padding: 20 }}>
          <div className="card-header" style={{ marginBottom: 16 }}>
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={18} style={{ color: 'var(--accent-indigo)' }} /> Evolução Financeira Diária (Últimos 14 dias)
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Comparativo entre receita de acertos e custo de produção diário</p>
            </div>
          </div>
          <div style={{ width: '100%', height: 300 }}>
            {charts.dailyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.dailyRevenue} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} tickFormatter={val => `R$ ${val}`} />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '0.8rem' }} />
                  <Area type="monotone" dataKey="revenue" name="Receita Acertos" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                  <Area type="monotone" dataKey="cost" name="Custo Produção" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCost)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Activity />
                <div className="empty-state-title">Sem movimentação nos últimos 14 dias</div>
              </div>
            )}
          </div>
        </div>

        {/* GRÁFICO 2: Composição de Custos e Saídas (PieChart) */}
        <div className="card" style={{ padding: 20 }}>
          <div className="card-header" style={{ marginBottom: 16 }}>
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PieIcon size={18} style={{ color: 'var(--accent-emerald)' }} /> Distribuição de Custos & Comissões
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Proporção de gastos operacionais no mês atual</p>
            </div>
          </div>
          <div style={{ width: '100%', height: 300 }}>
            {charts.costBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.costBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={95}
                    paddingAngle={5}
                  >
                    {charts.costBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<CurrencyTooltip />} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '0.78rem' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <PieIcon />
                <div className="empty-state-title">Nenhuma despesa ou custo registrado</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* GRÁFICO 3: Top Peças em Receita nas Bancas (BarChart) */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div className="card-header" style={{ marginBottom: 16 }}>
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={18} style={{ color: 'var(--accent-amber)' }} /> Top Peças Vendidas (Giro em Bancas)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Peças com maior faturamento gerado em acertos de consignação</p>
          </div>
        </div>
        <div style={{ width: '100%', height: 280 }}>
          {charts.topProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.topProducts} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} tickFormatter={val => `R$ ${val}`} />
                <Tooltip content={<CurrencyTooltip />} />
                <Bar dataKey="revenue" name="Receita Gerada" fill="var(--accent-indigo)" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <BarChart3 />
              <div className="empty-state-title">Nenhum acerto de mercadoria concluído ainda</div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Realize o primeiro acerto em uma banca para visualizar o ranking de vendas.</p>
            </div>
          )}
        </div>
      </div>

      {/* Production + Inventory Grid */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Production Summary */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><Factory size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />Resumo de Produção no Mês</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div className="stat-card-label">Total Ordens</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{prod.total || 0}</div>
              </div>
              <div>
                <div className="stat-card-label">Na Mesa (Imprimindo)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-indigo)' }}>{prod.printing || 0}</div>
              </div>
              <div>
                <div className="stat-card-label">Prontas para Envio</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>{prod.completed || 0}</div>
              </div>
              <div>
                <div className="stat-card-label">Perdas na Máquina</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-rose)' }}>{prod.failed || 0}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Inventory Alerts */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><Boxes size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />Estoque Crítico de Filamentos</h3>
            <span className="badge badge-indigo">{inv.totalRolls || 0} rolos na fábrica</span>
          </div>
          <div className="card-body">
            {inv.lowStockCount > 0 ? (
              <div>
                {inv.lowStockRolls?.map(roll => (
                  <div key={roll.id} className="alert alert-warning" style={{ marginBottom: 8 }}>
                    <AlertTriangle size={16} />
                    <span>
                      <strong>{roll.material} {roll.color}</strong> — {roll.brand}
                      <br />Restante no rolo: <strong>{formatWeight(roll.remainingWeightG)}</strong>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 30 }}>
                <Package />
                <div className="empty-state-title">Estoque Saudável</div>
                <div className="empty-state-text">Nenhum rolo com menos de 200g no momento</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reconhecedor de Ações / Últimas Movimentações */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h3 className="card-title">
            <History size={16} style={{ marginRight: 8, verticalAlign: 'middle', color: 'var(--accent-indigo)' }} />
            Reconhecedor de Ações — Últimas Movimentações no Sistema
          </h3>
          <a href="/usuarios" style={{ fontSize: '0.82rem', color: 'var(--accent-indigo)', textDecoration: 'none', fontWeight: 600 }}>
            Ver histórico completo de auditoria →
          </a>
        </div>
        <div className="card-body">
          {recentLogs.length === 0 ? (
            <div className="empty-state" style={{ padding: 30 }}>
              <Activity />
              <div className="empty-state-title">Nenhuma ação registrada nas últimas horas</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>As criações e atualizações feitas por qualquer usuário aparecerão instantaneamente aqui.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
              {recentLogs.map((item) => {
                let badgeBg = 'rgba(99, 102, 241, 0.15)';
                let badgeColor = 'var(--accent-indigo)';
                if (item.actionType === 'CRIAR') { badgeBg = 'rgba(16, 185, 129, 0.15)'; badgeColor = 'var(--accent-emerald)'; }
                if (item.actionType === 'EXCLUIR') { badgeBg = 'rgba(244, 63, 94, 0.15)'; badgeColor = '#F43F5E'; }
                if (item.actionType === 'CONCLUIR') { badgeBg = 'rgba(59, 130, 246, 0.15)'; badgeColor = '#3B82F6'; }

                return (
                  <div
                    key={item.id}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 10,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: badgeBg,
                          color: badgeColor,
                        }}
                      >
                        {item.actionType} • {item.module}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {item.description}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 6 }}>
                      Autor: <strong>{item.userName}</strong> ({item.userEmail})
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
