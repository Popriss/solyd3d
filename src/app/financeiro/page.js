'use client';
import { useState, useEffect } from 'react';
import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function FinanceiroPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fin = data?.financial || {};

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestão Financeira</h1>
          <p className="page-subtitle">Fluxo de caixa, despesas e receitas</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card emerald">
          <div className="stat-card-header"><div className="stat-card-icon emerald"><TrendingUp size={20} /></div></div>
          <div className="stat-card-label">Receita Mensal</div>
          <div className="stat-card-value">{formatCurrency(fin.totalRevenue || 0)}</div>
        </div>
        <div className="stat-card rose">
          <div className="stat-card-header"><div className="stat-card-icon rose"><TrendingDown size={20} /></div></div>
          <div className="stat-card-label">Despesas Totais</div>
          <div className="stat-card-value">{formatCurrency(fin.totalMonthlyCost || 0)}</div>
        </div>
        <div className="stat-card indigo">
          <div className="stat-card-header"><div className="stat-card-icon indigo"><DollarSign size={20} /></div></div>
          <div className="stat-card-label">Lucro Líquido</div>
          <div className="stat-card-value" style={{ color: (fin.estimatedNetProfit || 0) >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
            {formatCurrency(fin.estimatedNetProfit || 0)}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h3 className="card-title">Despesas Fixas</h3></div>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span className="stat-card-label">Total</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(fin.totalFixedExpenses || 0)}</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Parcelas de máquina, aluguel, assinaturas</p>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3 className="card-title">Despesas Variáveis</h3></div>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span className="stat-card-label">Total</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(fin.totalVariableExpenses || 0)}</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Filamentos, bicos, manutenção</p>
          </div>
        </div>
      </div>
    </div>
  );
}
