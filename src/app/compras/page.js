'use client';
import { useState, useEffect } from 'react';
import {
  ShoppingCart, DollarSign, Users, Plus, Trash2, CheckCircle2,
  AlertCircle, CreditCard, Wallet, ArrowUpRight, ArrowDownRight,
  UserCheck, ShieldCheck, Filter, RefreshCw, TrendingUp
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function ComprasPage() {
  const [activeTab, setActiveTab] = useState('compras'); // 'compras' | 'socios'
  const [purchases, setPurchases] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modais
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showPartnerModal, setShowPartnerModal] = useState(false);

  // Form states - Nova Compra
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState('PIX');
  const [installmentCount, setInstallmentCount] = useState('1');
  const [fundingSource, setFundingSource] = useState('BUSINESS_CASH');
  const [businessCashAmount, setBusinessCashAmount] = useState('');
  const [selectedPartners, setSelectedPartners] = useState([]);
  const [paidByPartnerId, setPaidByPartnerId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form states - Novo Sócio
  const [partnerName, setPartnerName] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');

  // Form states - Quitar Parcelas no Cartão
  const [splitModalData, setSplitModalData] = useState(null);
  const [payInstallmentCountInput, setPayInstallmentCountInput] = useState('1');
  const [payInstallmentValueInput, setPayInstallmentValueInput] = useState('');

  // Filtros - Contas a Receber / Pagar do Rateio
  const [filterPartnerId, setFilterPartnerId] = useState('');
  const [filterSplitStatus, setFilterSplitStatus] = useState('');
  const [filterSplitSearch, setFilterSplitSearch] = useState('');

  // Estado de Compensação / Netting de Dívidas
  const [nettingData, setNettingData] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resPurchases, resPartners, resNetting] = await Promise.all([
        fetch('/api/purchases').then((r) => r.json()),
        fetch('/api/partners').then((r) => r.json()),
        fetch('/api/purchases/netting').then((r) => r.json()),
      ]);
      if (!resPurchases.error) setPurchases(resPurchases);
      if (!resPartners.error) {
        setPartners(resPartners);
        // Por padrão ao criar compra com Aporte, selecionamos todos os sócios ativos
        setSelectedPartners(resPartners.filter((p) => p.active).map((p) => p.id));
      }
      if (!resNetting.error) setNettingData(resNetting);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // KPIs
  const totalSpent = purchases.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalBusinessCash = purchases
    .filter((p) => p.fundingSource === 'BUSINESS_CASH' || (p.businessCashAmount && Number(p.businessCashAmount) > 0))
    .reduce((sum, p) => sum + (p.businessCashAmount !== null && p.businessCashAmount !== undefined ? Number(p.businessCashAmount) : Number(p.amount || 0)), 0);
  const totalPartnerContribution = purchases
    .filter((p) => p.fundingSource === 'PARTNER_CONTRIBUTION')
    .reduce((sum, p) => {
      const biz = p.businessCashAmount ? Number(p.businessCashAmount) : 0;
      return sum + Math.max(0, Number(p.amount || 0) - biz);
    }, 0);
  const totalPendingSplit = partners.reduce((sum, pt) => sum + Number(pt.pendingToPay || 0), 0);

  // Submit Nova Compra
  const handleCreatePurchase = async (e) => {
    e.preventDefault();
    if (!desc || !amount || Number(amount) <= 0) {
      alert('Preencha a descrição e um valor válido (> 0).');
      return;
    }
    if (fundingSource === 'PARTNER_CONTRIBUTION' && selectedPartners.length === 0) {
      alert('Selecione pelo menos um sócio para a divisão/rateio da despesa.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: desc,
          amount: Number(amount),
          paymentMethod: payMethod,
          installmentCount: payMethod === 'CREDIT_CARD' ? Number(installmentCount) : null,
          installmentValue: payMethod === 'CREDIT_CARD' ? Number((Number(amount) / Number(installmentCount || 1)).toFixed(2)) : null,
          fundingSource,
          businessCashAmount: fundingSource === 'PARTNER_CONTRIBUTION' && businessCashAmount ? Number(businessCashAmount) : null,
          paidByPartnerId: paidByPartnerId ? Number(paidByPartnerId) : null,
          partnerIds: selectedPartners,
          notes,
        }),
      });

      if (res.ok) {
        setDesc('');
        setAmount('');
        setInstallmentCount('1');
        setBusinessCashAmount('');
        setNotes('');
        setPaidByPartnerId('');
        setShowPurchaseModal(false);
        loadData();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao criar compra.');
      }
    } catch (err) {
      alert('Erro na requisição.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Novo Sócio
  const handleCreatePartner = async (e) => {
    e.preventDefault();
    if (!partnerName.trim()) {
      alert('Nome do sócio é obrigatório.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: partnerName,
          email: partnerEmail,
          phone: partnerPhone,
        }),
      });
      if (res.ok) {
        setPartnerName('');
        setPartnerEmail('');
        setPartnerPhone('');
        setShowPartnerModal(false);
        loadData();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao cadastrar sócio.');
      }
    } catch (err) {
      alert('Erro na requisição.');
    } finally {
      setSubmitting(false);
    }
  };

  // Deletar Compra
  const handleDeletePurchase = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta compra? Todos os rateios associados serão removidos.')) return;
    try {
      const res = await fetch(`/api/purchases?id=${id}`, { method: 'DELETE' });
      if (res.ok) loadData();
      else alert('Erro ao excluir.');
    } catch (err) {
      alert('Erro ao excluir.');
    }
  };

  // Quitar/Dar Baixa em um Rateio de Sócio
  const handleSettleSplit = async (splitId) => {
    try {
      const res = await fetch('/api/purchases/splits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ splitId }),
      });
      if (res.ok) {
        loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Erro ao quitar rateio.');
      }
    } catch (err) {
      alert('Erro na requisição para quitar rateio.');
    }
  };

  // Abrir Modal de Quitar X Parcelas (Cartão de Crédito)
  const handleOpenInstallmentModal = (split, purchase) => {
    const totalInst = purchase.installmentCount || 1;
    const paidInst = split.installmentsPaid || 0;
    
    setSplitModalData({ split, purchase });
    setPayInstallmentCountInput('1');
    const expectedPerInst = Number(split.amountExpected) / totalInst;
    setPayInstallmentValueInput(expectedPerInst.toFixed(2));
  };

  // Submeter quitação de X parcelas no Cartão
  const handleSettleInstallmentSubmit = async (e) => {
    e.preventDefault();
    if (!splitModalData) return;
    const { split, purchase } = splitModalData;

    const addedInst = Number(payInstallmentCountInput);
    const addedVal = Number(payInstallmentValueInput);

    if (addedInst <= 0 || addedVal <= 0) {
      alert('Informe uma quantidade de parcelas e valor válidos (> 0).');
      return;
    }

    setSubmitting(true);
    try {
      const newAmountPaid = Number(split.amountPaid || 0) + addedVal;
      const newInstPaid = Number(split.installmentsPaid || 0) + addedInst;

      const res = await fetch('/api/purchases/splits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          splitId: split.id,
          amountPaid: newAmountPaid,
          installmentsPaid: newInstPaid,
        }),
      });

      if (res.ok) {
        setSplitModalData(null);
        loadData();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao quitar parcelas.');
      }
    } catch (err) {
      alert('Erro na requisição.');
    } finally {
      setSubmitting(false);
    }
  };

  // Alternar seleção de sócio no checkbox de rateio
  const togglePartnerSelection = (pid) => {
    if (selectedPartners.includes(pid)) {
      setSelectedPartners(selectedPartners.filter((id) => id !== pid));
    } else {
      setSelectedPartners([...selectedPartners, pid]);
    }
  };

  return (
    <div className="page-container">
      {/* Header com botões */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShoppingCart style={{ color: 'var(--accent-indigo)' }} size={26} />
            Compras e Gestão de Despesas
          </h1>
          <p className="page-subtitle">
            Controle de gastos, origens financeiras (Caixa vs Aportes) e rateio interno entre sócios
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowPartnerModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Users size={16} /> Cadastrar Sócio
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowPurchaseModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} /> Nova Compra / Despesa
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card indigo">
          <div className="stat-card-header">
            <div className="stat-card-icon indigo"><ShoppingCart size={20} /></div>
          </div>
          <div className="stat-card-label">Total em Compras / Despesas</div>
          <div className="stat-card-value">{formatCurrency(totalSpent)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {purchases.length} compras registradas
          </div>
        </div>

        <div className="stat-card emerald">
          <div className="stat-card-header">
            <div className="stat-card-icon emerald"><Wallet size={20} /></div>
          </div>
          <div className="stat-card-label">Financiado p/ Caixa do Negócio</div>
          <div className="stat-card-value" style={{ color: 'var(--accent-emerald)' }}>{formatCurrency(totalBusinessCash)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Deduz diretamente do lucro das bancas
          </div>
        </div>

        <div className="stat-card amber">
          <div className="stat-card-header">
            <div className="stat-card-icon amber"><Users size={20} /></div>
          </div>
          <div className="stat-card-label">Financiado p/ Aporte de Sócios</div>
          <div className="stat-card-value" style={{ color: 'var(--accent-amber)' }}>{formatCurrency(totalPartnerContribution)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Sem deduzir do caixa das vendas de peças
          </div>
        </div>

        <div className="stat-card rose">
          <div className="stat-card-header">
            <div className="stat-card-icon rose"><AlertCircle size={20} /></div>
          </div>
          <div className="stat-card-label">Rateio Interno Pendente</div>
          <div className="stat-card-value" style={{ color: totalPendingSplit > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
            {formatCurrency(totalPendingSplit)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Saldos a depositar pelos sócios
          </div>
        </div>
      </div>

      {/* Seletor de Abas */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          borderBottom: '1px solid var(--border-primary)',
          paddingBottom: 12,
          marginBottom: 24,
        }}
      >
        <button
          onClick={() => setActiveTab('compras')}
          style={{
            background: activeTab === 'compras' ? 'var(--accent-indigo)' : 'var(--bg-secondary)',
            color: activeTab === 'compras' ? '#fff' : 'var(--text-secondary)',
            border: '1px solid var(--border-primary)',
            padding: '10px 20px',
            borderRadius: 8,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s',
          }}
        >
          <ShoppingCart size={18} /> Histórico de Compras ({purchases.length})
        </button>
        <button
          onClick={() => setActiveTab('socios')}
          style={{
            background: activeTab === 'socios' ? 'var(--accent-indigo)' : 'var(--bg-secondary)',
            color: activeTab === 'socios' ? '#fff' : 'var(--text-secondary)',
            border: '1px solid var(--border-primary)',
            padding: '10px 20px',
            borderRadius: 8,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s',
          }}
        >
          <Users size={18} /> Sócios & Contas Internas de Rateio ({partners.length})
        </button>
        <button
          onClick={() => setActiveTab('netting')}
          style={{
            background: activeTab === 'netting' ? 'var(--accent-indigo)' : 'var(--bg-secondary)',
            color: activeTab === 'netting' ? '#fff' : 'var(--text-secondary)',
            border: '1px solid var(--border-primary)',
            padding: '10px 20px',
            borderRadius: 8,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s',
          }}
        >
          <TrendingUp size={18} /> ⚖️ Compensação & Saldos Cruzados (Netting)
        </button>
      </div>

      {/* CONTEÚDO DA ABA 1: HISTÓRICO DE COMPRAS */}
      {activeTab === 'compras' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingCart size={18} /> Registro Geral de Compras e Despesas
            </h3>
            <button
              onClick={loadData}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <RefreshCw size={14} /> Atualizar
            </button>
          </div>
          <div className="card-body">
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }}></div>
              </div>
            ) : purchases.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <ShoppingCart size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                <div className="empty-state-title">Nenhuma compra cadastrada ainda</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  Clique no botão &quot;Nova Compra / Despesa&quot; acima para lançar filamentos, peças de reposição ou parcelas.
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Descrição do Item</th>
                      <th>Origem do Dinheiro</th>
                      <th>Método</th>
                      <th>Valor Total</th>
                      <th>Rateio / Detalhe</th>
                      <th style={{ textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((p) => {
                      const isBusiness = p.fundingSource === 'BUSINESS_CASH';
                      const payMap = {
                        CREDIT_CARD: 'Cartão de Crédito',
                        DEBIT_CARD: 'Cartão de Débito',
                        PIX: 'Pix / Transf.',
                      };

                      return (
                        <tr key={p.id}>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {formatDate(p.purchaseDate)}
                          </td>
                          <td>
                            <strong style={{ color: 'var(--text-primary)', display: 'block' }}>
                              {p.description}
                            </strong>
                            {p.notes && (
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {p.notes}
                              </span>
                            )}
                          </td>
                          <td>
                            {isBusiness ? (
                              <span className="badge badge-emerald" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Wallet size={13} /> Caixa do Negócio
                              </span>
                            ) : (
                              <span className="badge badge-indigo" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Users size={13} /> Aporte de Sócios
                              </span>
                            )}
                          </td>
                          <td>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block' }}>
                              {payMap[p.paymentMethod] || p.paymentMethod}
                            </span>
                            {p.installmentCount && Number(p.installmentCount) > 1 && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--accent-indigo)', fontWeight: 600 }}>
                                {p.installmentCount}x de {formatCurrency(p.installmentValue || Number(p.amount) / p.installmentCount)}/mês
                              </span>
                            )}
                          </td>
                          <td>
                            <strong style={{ color: isBusiness ? 'var(--accent-emerald)' : 'var(--accent-amber)', fontSize: '0.95rem' }}>
                              {formatCurrency(p.amount)}
                            </strong>
                          </td>
                          <td>
                            {isBusiness ? (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                — (Deduzido das vendas)
                              </span>
                            ) : (
                              <div>
                                {p.businessCashAmount && Number(p.businessCashAmount) > 0 && (
                                  <div style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                                    + {formatCurrency(p.businessCashAmount)} do Caixa das Vendas
                                  </div>
                                )}
                                {p.paidByPartner && (
                                  <div style={{ fontSize: '0.78rem', color: 'var(--accent-indigo)', fontWeight: 600 }}>
                                    Adiantado por: {p.paidByPartner.name}
                                  </div>
                                )}
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                  Dividido entre {p.splits?.length || 0} sócio(s)
                                </div>
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => handleDeletePurchase(p.id)}
                              className="btn btn-danger"
                              style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                              title="Excluir Compra"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: SÓCIOS & CONTAS INTERNAS (RATEIO) */}
      {activeTab === 'socios' && (
        <div>
          {/* Grid de Sócios */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
            {partners.length === 0 ? (
              <div className="card" style={{ gridColumn: '1 / -1', padding: 30, textAlign: 'center' }}>
                <Users size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 10px' }} />
                <h4>Nenhum sócio cadastrado para rateio</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: 6 }}>
                  Cadastre os sócios da empresa (Ex: Carlos, Marcos, Juliana) para dividir aportes e despesas.
                </p>
                <button
                  onClick={() => setShowPartnerModal(true)}
                  className="btn btn-primary"
                  style={{ marginTop: 12 }}
                >
                  <Plus size={16} /> Cadastrar Primeiro Sócio
                </button>
              </div>
            ) : (
              partners.map((partner) => {
                const pending = Number(partner.pendingToPay || 0);
                const advanced = Number(partner.totalAdvanced || 0);
                const contributed = Number(partner.totalContributed || 0);

                return (
                  <div key={partner.id} className="card" style={{ padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                          {partner.name}
                        </h4>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {partner.email || partner.phone || 'Sócio Cadastrado'}
                        </span>
                      </div>
                      <span className={`badge ${partner.active ? 'badge-emerald' : 'badge-rose'}`}>
                        {partner.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 8, marginTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Aportes Já Realizados:</span>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{formatCurrency(contributed)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Antecipações (Pagou p/ Todos):</span>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--accent-indigo)' }}>{formatCurrency(advanced)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-primary)', paddingTop: 6, marginTop: 6 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Pendente a Depositar:</span>
                        <strong style={{ fontSize: '0.95rem', color: pending > 0 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
                          {pending > 0 ? formatCurrency(pending) : 'Quitado / Ok'}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Tabela de Contas a Receber / Pagar do Rateio (PurchaseSplits) */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CreditCard size={18} style={{ color: 'var(--accent-indigo)' }} />
                    Contas a Receber / Pagar (Detalhamento do Rateio de Aportes)
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    Todas as compras financiadas por Aporte de Sócios e como a conta foi dividida. Clique em &quot;Quitar&quot; quando o sócio transferir a cota.
                  </p>
                </div>

                {(filterPartnerId || filterSplitStatus || filterSplitSearch) && (
                  <button
                    onClick={() => {
                      setFilterPartnerId('');
                      setFilterSplitStatus('');
                      setFilterSplitSearch('');
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    Limpar Filtros
                  </button>
                )}
              </div>

              {/* BARRA DE FILTROS DO RATEIO */}
              <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: 14, marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, alignItems: 'end' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem', margin: '0 0 6px' }}>Filtrar por Sócio Rateado</label>
                  <select
                    className="form-input"
                    style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                    value={filterPartnerId}
                    onChange={(e) => setFilterPartnerId(e.target.value)}
                  >
                    <option value="">Todos os Sócios</option>
                    {partners.map((pt) => (
                      <option key={pt.id} value={pt.id}>
                        {pt.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem', margin: '0 0 6px' }}>Status do Depósito</label>
                  <select
                    className="form-input"
                    style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                    value={filterSplitStatus}
                    onChange={(e) => setFilterSplitStatus(e.target.value)}
                  >
                    <option value="">Todos os Status</option>
                    <option value="PENDING">🔴 Devendo Aporte (Pendente)</option>
                    <option value="SETTLED">🟢 Quitado / Aportado</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem', margin: '0 0 6px' }}>Buscar Compra / Descrição</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ padding: '8px 10px', fontSize: '0.85rem' }}
                    placeholder="Ex: Sacos à vácuo, Retífica..."
                    value={filterSplitSearch}
                    onChange={(e) => setFilterSplitSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="card-body">
              {(() => {
                const allSplits = purchases
                  .filter((p) => p.fundingSource === 'PARTNER_CONTRIBUTION')
                  .flatMap((p) =>
                    (p.splits || []).map((split) => ({ ...split, purchase: p }))
                  );

                if (allSplits.length === 0) {
                  return (
                    <div className="empty-state" style={{ padding: 30 }}>
                      <Users size={36} />
                      <div className="empty-state-title">Nenhum rateio entre sócios gerado ainda</div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        Ao registrar uma nova compra com origem &quot;Aporte de Sócios&quot;, o sistema gerará automaticamente as cotas individuais aqui.
                      </p>
                    </div>
                  );
                }

                const filteredSplits = allSplits.filter((item) => {
                  if (filterPartnerId && String(item.partnerId) !== String(filterPartnerId)) {
                    return false;
                  }
                  if (filterSplitStatus && item.status !== filterSplitStatus) {
                    return false;
                  }
                  if (filterSplitSearch && filterSplitSearch.trim() !== '') {
                    const q = filterSplitSearch.toLowerCase();
                    const descMatch = (item.purchase?.description || '').toLowerCase().includes(q);
                    const partnerMatch = (item.partner?.name || '').toLowerCase().includes(q);
                    if (!descMatch && !partnerMatch) return false;
                  }
                  return true;
                });

                if (filteredSplits.length === 0) {
                  return (
                    <div className="empty-state" style={{ padding: 30 }}>
                      <AlertCircle size={32} style={{ color: 'var(--text-muted)' }} />
                      <div className="empty-state-title" style={{ fontSize: '1rem', marginTop: 10 }}>Nenhum rateio encontrado com estes filtros</div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        Tente limpar a busca ou selecionar outro sócio/status.
                      </p>
                      <button
                        onClick={() => {
                          setFilterPartnerId('');
                          setFilterSplitStatus('');
                          setFilterSplitSearch('');
                        }}
                        className="btn btn-secondary"
                        style={{ marginTop: 12, padding: '6px 14px', fontSize: '0.8rem' }}
                      >
                        Limpar Filtros
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="table-responsive">
                    <table className="data-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px', tableLayout: 'auto' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: '8px 0 0 8px' }}>Compra Original</th>
                          <th style={{ padding: '12px 14px', background: 'var(--bg-secondary)' }}>Sócio Rateado</th>
                          <th style={{ padding: '12px 14px', background: 'var(--bg-secondary)' }}>Cota Esperada</th>
                          <th style={{ padding: '12px 14px', background: 'var(--bg-secondary)' }}>Para Quem Enviar?</th>
                          <th style={{ padding: '12px 14px', background: 'var(--bg-secondary)' }}>Aportado & Progresso</th>
                          <th style={{ padding: '12px 14px', background: 'var(--bg-secondary)' }}>Status do Depósito</th>
                          <th style={{ padding: '12px 14px', background: 'var(--bg-secondary)', textAlign: 'right', borderRadius: '0 8px 8px 0' }}>Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSplits.map((split) => {
                          const p = split.purchase;
                          const isPending = split.status === 'PENDING';
                          const isSelfPaid = p.paidByPartnerId && Number(split.partnerId) === Number(p.paidByPartnerId);

                          return (
                            <tr key={split.id} style={{ background: 'var(--bg-card)', transition: 'all 0.2s ease' }}>
                              {/* COMPRA ORIGINAL */}
                              <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-primary)', verticalAlign: 'middle', minWidth: '150px', maxWidth: '230px', whiteSpace: 'normal' }}>
                                <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '0.88rem', lineHeight: '1.3', marginBottom: 2 }}>
                                  {p.description}
                                </strong>
                                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block' }}>
                                  R$ {Number(p.amount).toFixed(2)} • {formatDate(p.purchaseDate)}
                                </span>
                              </td>

                              {/* SÓCIO RATEADO */}
                              <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-primary)', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(129, 140, 248, 0.1)', border: '1px solid rgba(129, 140, 248, 0.25)', padding: '4px 10px', borderRadius: 6 }}>
                                  <Users size={14} style={{ color: 'var(--accent-indigo)' }} />
                                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                    {split.partner?.name || 'Sócio'}
                                  </strong>
                                </div>
                              </td>

                              {/* COTA ESPERADA */}
                              <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-primary)', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                                  {formatCurrency(split.amountExpected)}
                                </strong>
                              </td>

                              {/* PARA QUEM ENVIAR O VALOR? */}
                              <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-primary)', verticalAlign: 'middle', minWidth: '150px', maxWidth: '200px', whiteSpace: 'normal' }}>
                                {isSelfPaid ? (
                                  <span className="badge badge-violet" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: '0.72rem' }}>
                                    ✨ Antecipou (Credor)
                                  </span>
                                ) : p.paidByPartnerId ? (
                                  <div>
                                    <span className="badge badge-indigo" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', padding: '4px 8px' }}>
                                      👤 Enviar para: {p.paidByPartner?.name}
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: 2, lineHeight: '1.2' }}>
                                      Sócio adiantou a compra
                                    </span>
                                  </div>
                                ) : (
                                  <div>
                                    <span className="badge badge-emerald" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', padding: '4px 8px' }}>
                                      🏢 Conta da Empresa
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: 2, lineHeight: '1.2' }}>
                                      Repor caixa da empresa
                                    </span>
                                  </div>
                                )}
                              </td>

                              {/* APORTADO & PROGRESSO */}
                              <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-primary)', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                <span style={{ color: isPending ? 'var(--accent-rose)' : 'var(--accent-emerald)', fontWeight: 700, fontSize: '0.9rem', display: 'block' }}>
                                  {formatCurrency(split.amountPaid)}
                                </span>
                                {p.paymentMethod === 'CREDIT_CARD' && p.installmentCount && Number(p.installmentCount) > 1 && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--accent-indigo)', fontWeight: 600, display: 'block', marginTop: 1 }}>
                                    ({split.installmentsPaid || 0}/{p.installmentCount} parc.)
                                  </span>
                                )}
                              </td>

                              {/* STATUS DO DEPÓSITO */}
                              <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-primary)', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                {isPending && split.installmentsPaid && Number(split.installmentsPaid) > 0 ? (
                                  <span className="badge badge-amber" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: '0.72rem' }}>
                                    <CreditCard size={12} /> {split.installmentsPaid}/{p.installmentCount} Parc.
                                  </span>
                                ) : isPending ? (
                                  <span className="badge badge-rose" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: '0.72rem' }}>
                                    <AlertCircle size={12} /> Devendo
                                  </span>
                                ) : (
                                  <span className="badge badge-emerald" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: '0.72rem' }}>
                                    <CheckCircle2 size={12} /> Quitado
                                  </span>
                                )}
                              </td>

                              {/* AÇÃO DE QUITAÇÃO */}
                              <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-primary)', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                {isPending && p.paymentMethod === 'CREDIT_CARD' && p.installmentCount && Number(p.installmentCount) > 1 ? (
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                                    <button
                                      onClick={() => handleOpenInstallmentModal(split, p)}
                                      className="btn btn-primary"
                                      style={{ padding: '6px 10px', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                      title="Quitar Parcela(s) Específica(s)"
                                    >
                                      <CreditCard size={14} /> Parcelas
                                    </button>
                                    <button
                                      onClick={() => handleSettleSplit(split.id)}
                                      className="btn btn-secondary"
                                      style={{ padding: '6px 10px', fontSize: '0.74rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                      title="Quitar Saldo Total de uma vez"
                                    >
                                      <CheckCircle2 size={14} /> Total
                                    </button>
                                  </div>
                                ) : isPending ? (
                                  <button
                                    onClick={() => handleSettleSplit(split.id)}
                                    className="btn btn-primary"
                                    style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                                  >
                                    <CheckCircle2 size={14} /> Quitar / Depositar
                                  </button>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 500 }}>
                                    ✔ Acertado
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 3: COMPENSAÇÃO DE DÍVIDAS & SALDOS CRUZADOS (NETTING) */}
      {activeTab === 'netting' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Header & Métricas do Netting */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={20} style={{ color: 'var(--accent-indigo)' }} />
                  Compensação Automática de Dívidas (Debt Netting)
                </h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  O sistema cruza débitos mútuos entre os sócios e a conta da empresa para anular transferências redundantes e exibir apenas o saldo líquido final.
                </p>
              </div>
              <button
                onClick={loadData}
                className="btn btn-secondary"
                style={{ padding: '8px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={15} /> Recalcular Compensação
              </button>
            </div>

            <div className="card-body">
              {loading || !nettingData ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }}></div>
                  <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>Cruzando transações bilaterais e calculando saldo líquido...</p>
                </div>
              ) : (
                <div>
                  {/* Resumo em 3 Cartões de KPI */}
                  <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: 28 }}>
                    <div className="stat-card" style={{ borderLeft: '4px solid var(--text-muted)' }}>
                      <div className="stat-card-label">Dívida Bruta Acumulada</div>
                      <div className="stat-card-value" style={{ color: 'var(--text-primary)' }}>
                        {formatCurrency(nettingData?.metrics?.totalGrossDebt || 0)}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        Soma de todas as parcelas pendentes sem cruzamento
                      </div>
                    </div>

                    <div className="stat-card emerald" style={{ borderLeft: '4px solid var(--accent-emerald)' }}>
                      <div className="stat-card-label">Dívida Líquida Pós-Compensação</div>
                      <div className="stat-card-value" style={{ color: 'var(--accent-emerald)' }}>
                        {formatCurrency(nettingData?.metrics?.totalNetDebt || 0)}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        Valor real que precisa ser movimentado/depositado
                      </div>
                    </div>

                    <div className="stat-card indigo" style={{ borderLeft: '4px solid var(--accent-indigo)' }}>
                      <div className="stat-card-label">Economia no Fluxo de Transferências</div>
                      <div className="stat-card-value" style={{ color: 'var(--accent-indigo)' }}>
                        {formatCurrency(nettingData?.metrics?.totalSavedByNetting || 0)}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        Dívidas mútuas anuladas automaticamente
                      </div>
                    </div>
                  </div>

                  {/* PAINEL DE SITUAÇÃO INDIVIDUAL: QUEM DEVE / QUEM TEM A RECEBER */}
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users size={18} style={{ color: 'var(--accent-indigo)' }} />
                    Painel de Saldos por Participante
                  </h4>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                      gap: 16,
                      marginBottom: 32,
                    }}
                  >
                    {nettingData?.participantsSummary?.map((p) => {
                      const isCreditor = p.netBalance > 0;
                      const isDebtor = p.netBalance < 0;
                      const isZero = p.netBalance === 0;

                      return (
                        <div
                          key={p.id}
                          style={{
                            background: p.isCompany ? 'rgba(129, 140, 248, 0.06)' : 'var(--bg-secondary)',
                            border: p.isCompany ? '2px solid rgba(129, 140, 248, 0.4)' : '1px solid var(--border-primary)',
                            borderRadius: 12,
                            padding: 18,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                              <div>
                                <h5 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {p.isCompany ? '🏢' : '👤'} {p.name}
                                </h5>
                                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                  {p.isCompany ? 'Caixa Jurídico / Conta da Empresa' : 'Sócio Cotista'}
                                </span>
                              </div>

                              {isCreditor && (
                                <span className="badge badge-emerald" style={{ padding: '6px 10px', fontSize: '0.8rem', fontWeight: 700 }}>
                                  + {formatCurrency(p.netBalance)} a Receber
                                </span>
                              )}
                              {isDebtor && (
                                <span className="badge badge-rose" style={{ padding: '6px 10px', fontSize: '0.8rem', fontWeight: 700 }}>
                                  {formatCurrency(Math.abs(p.netBalance))} a Pagar
                                </span>
                              )}
                              {isZero && (
                                <span className="badge badge-secondary" style={{ padding: '6px 10px', fontSize: '0.78rem' }}>
                                  ✔ Quitado
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', gap: 12, borderTop: '1px solid var(--border-primary)', borderBottom: '1px solid var(--border-primary)', padding: '10px 0', marginBottom: 12 }}>
                              <div style={{ flex: 1 }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Total a Receber:</span>
                                <strong style={{ fontSize: '0.88rem', color: p.totalToReceive > 0 ? 'var(--accent-emerald)' : 'var(--text-secondary)' }}>
                                  {formatCurrency(p.totalToReceive)}
                                </strong>
                              </div>
                              <div style={{ flex: 1, borderLeft: '1px solid var(--border-primary)', paddingLeft: 12 }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>Total a Pagar:</span>
                                <strong style={{ fontSize: '0.88rem', color: p.totalToPay > 0 ? 'var(--accent-rose)' : 'var(--text-secondary)' }}>
                                  {formatCurrency(p.totalToPay)}
                                </strong>
                              </div>
                            </div>

                            {/* Detalhamento de Para Quem Pagar ou De Quem Receber */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {p.debtsDetails?.length > 0 && (
                                <div>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-rose)', display: 'block', marginBottom: 4 }}>
                                    🎯 Precisa Enviar o Valor Para:
                                  </span>
                                  {p.debtsDetails.map((item, idx) => (
                                    <div key={idx} style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: 6, padding: '6px 10px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                      <span>Enviar para <strong>{item.targetName}</strong></span>
                                      <span style={{ fontWeight: 700, color: 'var(--accent-rose)' }}>{formatCurrency(item.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {p.receivablesDetails?.length > 0 && (
                                <div>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-emerald)', display: 'block', marginBottom: 4 }}>
                                    📥 Vai Receber De:
                                  </span>
                                  {p.receivablesDetails.map((item, idx) => (
                                    <div key={idx} style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 6, padding: '6px 10px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                      <span>Receber de <strong>{item.sourceName}</strong></span>
                                      <span style={{ fontWeight: 700, color: 'var(--accent-emerald)' }}>{formatCurrency(item.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {p.debtsDetails?.length === 0 && p.receivablesDetails?.length === 0 && (
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', display: 'block', padding: '6px 0' }}>
                                  Nenhuma pendência ou crédito compensado.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* MATRIZ DE COMPENSAÇÃO FINAL ("QUEM DEVE PARA QUEM") */}
                  <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 24 }}>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle2 size={18} style={{ color: 'var(--accent-emerald)' }} />
                      Matriz Simplificada de Compensação Direta ("Quem Deve Para Quem")
                    </h4>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                      Abaixo estão as únicas transferências reais necessárias após o cruzamento e abate automático das dívidas bilaterais:
                    </p>

                    {nettingData?.netDebts?.length === 0 ? (
                      <div className="empty-state" style={{ padding: 40, background: 'var(--bg-secondary)', borderRadius: 12 }}>
                        <CheckCircle2 size={44} style={{ color: 'var(--accent-emerald)', marginBottom: 12 }} />
                        <div className="empty-state-title" style={{ color: 'var(--text-primary)' }}>Todas as contas estão zeradas e liquidadas!</div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: 450, margin: '0 auto' }}>
                          Não há saldos pendentes ou compensações a serem realizadas entre os sócios e a conta da empresa no momento.
                        </p>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="data-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                          <thead>
                            <tr>
                              <th style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: '8px 0 0 8px' }}>👤 Sócio Devedor (Origem)</th>
                              <th style={{ padding: '12px 16px', background: 'var(--bg-secondary)', textAlign: 'center' }}>➡️ Fluxo</th>
                              <th style={{ padding: '12px 16px', background: 'var(--bg-secondary)' }}>🏢 / 👤 Credor Destinatário (Quem Recebe)</th>
                              <th style={{ padding: '12px 16px', background: 'var(--bg-secondary)' }}>Valor Bruto Original</th>
                              <th style={{ padding: '12px 16px', background: 'var(--bg-secondary)' }}>Economia com Cruzamento</th>
                              <th style={{ padding: '12px 16px', background: 'var(--bg-secondary)', textAlign: 'right', borderRadius: '0 8px 8px 0' }}>Valor Líquido a Transferir</th>
                            </tr>
                          </thead>
                          <tbody>
                            {nettingData.netDebts.map((item, idx) => {
                              const isToCompany = item.creditorId === 'COMPANY';
                              return (
                                <tr key={idx} style={{ background: 'var(--bg-card)' }}>
                                  <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-primary)', verticalAlign: 'middle' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.25)', padding: '5px 12px', borderRadius: 8 }}>
                                      <Users size={14} style={{ color: 'var(--accent-rose)' }} />
                                      <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{item.debtorName}</strong>
                                    </div>
                                  </td>

                                  <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-primary)', verticalAlign: 'middle', textAlign: 'center' }}>
                                    <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>➡️</span>
                                  </td>

                                  <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-primary)', verticalAlign: 'middle' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: isToCompany ? 'rgba(16, 185, 129, 0.1)' : 'rgba(129, 140, 248, 0.1)', border: isToCompany ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(129, 140, 248, 0.25)', padding: '5px 12px', borderRadius: 8 }}>
                                      {isToCompany ? <Wallet size={14} style={{ color: 'var(--accent-emerald)' }} /> : <Users size={14} style={{ color: 'var(--accent-indigo)' }} />}
                                      <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{item.creditorName}</strong>
                                    </div>
                                  </td>

                                  <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-primary)', verticalAlign: 'middle' }}>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                                      {formatCurrency(item.grossOriginal)}
                                    </span>
                                  </td>

                                  <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-primary)', verticalAlign: 'middle' }}>
                                    {item.nettedSavings > 0 ? (
                                      <span className="badge badge-indigo" style={{ padding: '4px 8px', fontSize: '0.74rem' }}>
                                        ⚡ Abateu {formatCurrency(item.nettedSavings)}
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sem dívida reversa</span>
                                    )}
                                  </td>

                                  <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-primary)', verticalAlign: 'middle', textAlign: 'right' }}>
                                    <strong style={{ color: 'var(--accent-emerald)', fontSize: '1.05rem', background: 'rgba(16, 185, 129, 0.08)', padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                      {formatCurrency(item.netAmount)}
                                    </strong>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CADASTRAR NOVO SÓCIO */}
      {showPartnerModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h3 className="modal-title">Cadastrar Sócio para Rateio</h3>
              <button className="modal-close" onClick={() => setShowPartnerModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreatePartner}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nome do Sócio *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex: Carlos Oliveira, Marcos Silva..."
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">E-mail (Opcional)</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="carlos@solyd3d.com"
                    value={partnerEmail}
                    onChange={(e) => setPartnerEmail(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone / WhatsApp (Opcional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="(11) 99999-9999"
                    value={partnerPhone}
                    onChange={(e) => setPartnerPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPartnerModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Cadastrando...' : 'Cadastrar Sócio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REGISTRAR NOVA COMPRA E DESPESA */}
      {showPurchaseModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <h3 className="modal-title">Registrar Nova Compra / Despesa</h3>
              <button className="modal-close" onClick={() => setShowPurchaseModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreatePurchase}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Descrição do Item Gasto *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex: 5x Rolos PETG Preto, Peça do bico da K1 Max, Parcela de Máquina..."
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    required
                  />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Valor Total (R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      placeholder="0,00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Método de Pagamento</label>
                    <select
                      className="form-input"
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                    >
                      <option value="PIX">Pix / Transferência</option>
                      <option value="CREDIT_CARD">Cartão de Crédito</option>
                      <option value="DEBIT_CARD">Cartão de Débito</option>
                    </select>
                  </div>
                </div>

                {payMethod === 'CREDIT_CARD' && (
                  <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid var(--accent-indigo)', borderRadius: 8, padding: 12, marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label className="form-label" style={{ margin: 0, fontWeight: 700, color: 'var(--accent-indigo)' }}>
                        Quantidade de Parcelas:
                      </label>
                      <select
                        className="form-input"
                        style={{ width: 120, padding: '6px 10px' }}
                        value={installmentCount}
                        onChange={(e) => setInstallmentCount(e.target.value)}
                      >
                        {[...Array(24)].map((_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}x {i + 1 === 1 ? '(À Vista)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Ficará em: <span style={{ color: 'var(--accent-indigo)', fontSize: '1.05rem' }}>{formatCurrency(Number(amount || 0) / Number(installmentCount || 1))}</span> / mês
                    </div>
                  </div>
                )}

                <div className="form-group" style={{ marginTop: 16 }}>
                  <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    Origem do Dinheiro (Funding Source) *
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                    <div
                      onClick={() => setFundingSource('BUSINESS_CASH')}
                      style={{
                        padding: 14,
                        borderRadius: 10,
                        border: `2px solid ${fundingSource === 'BUSINESS_CASH' ? 'var(--accent-emerald)' : 'var(--border-primary)'}`,
                        background: fundingSource === 'BUSINESS_CASH' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--accent-emerald)' }}>
                        <Wallet size={18} /> Caixa do Negócio
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>
                        Financiado pelas vendas das bancas. Deduz direto do lucro sem cobrar dos sócios.
                      </p>
                    </div>

                    <div
                      onClick={() => setFundingSource('PARTNER_CONTRIBUTION')}
                      style={{
                        padding: 14,
                        borderRadius: 10,
                        border: `2px solid ${fundingSource === 'PARTNER_CONTRIBUTION' ? 'var(--accent-indigo)' : 'var(--border-primary)'}`,
                        background: fundingSource === 'PARTNER_CONTRIBUTION' ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: 'var(--accent-indigo)' }}>
                        <Users size={18} /> Aporte de Sócios
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>
                        Injeção de capital dos donos. Divide o valor por X pessoas sem deduzir das vendas.
                      </p>
                    </div>
                  </div>
                </div>

                {/* PAINEL DINÂMICO SE FOR APORTE DE SÓCIOS */}
                {fundingSource === 'PARTNER_CONTRIBUTION' && (
                  <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 10, padding: 14, marginTop: 16 }}>
                    {/* QUANTIDADE DO CAIXA DO NEGÓCIO NO APORTE */}
                    <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid var(--accent-emerald)', borderRadius: 8, padding: 12, marginBottom: 14 }}>
                      <label className="form-label" style={{ color: 'var(--accent-emerald)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 6px' }}>
                        <Wallet size={15} /> Quantidade do Caixa do Negócio (Ajuda / Co-participação)
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 180px' }}>
                          <input
                            type="number"
                            step="0.01"
                            className="form-input"
                            placeholder="R$ 0,00 da empresa ajudou..."
                            value={businessCashAmount}
                            onChange={(e) => setBusinessCashAmount(e.target.value)}
                          />
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          Sai do Caixa: <strong style={{ color: 'var(--accent-emerald)' }}>{formatCurrency(businessCashAmount || 0)}</strong>
                        </div>
                      </div>
                    </div>

                    <label className="form-label" style={{ color: 'var(--accent-indigo)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Users size={16} /> Rateio do Restante — Dividir entre quais Sócios? ($X$ pessoas)
                    </label>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                      Valor a ratear ({formatCurrency(Math.max(0, Number(amount || 0) - Number(businessCashAmount || 0)))}): 
                      O sistema calculará <strong style={{ color: 'var(--accent-indigo)' }}>R$ {(Math.max(0, Number(amount || 0) - Number(businessCashAmount || 0)) / (selectedPartners.length || 1)).toFixed(2)}</strong> por pessoa.
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {partners.filter((p) => p.active).map((pt) => {
                        const isSelected = selectedPartners.includes(pt.id);
                        return (
                          <div
                            key={pt.id}
                            onClick={() => togglePartnerSelection(pt.id)}
                            style={{
                              padding: '8px 14px',
                              borderRadius: 20,
                              border: `1px solid ${isSelected ? 'var(--accent-indigo)' : 'var(--border-primary)'}`,
                              background: isSelected ? 'var(--accent-indigo)' : 'var(--bg-secondary)',
                              color: isSelected ? '#fff' : 'var(--text-primary)',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: isSelected ? '#fff' : 'transparent' }} />
                            {pt.name}
                          </div>
                        );
                      })}
                    </div>

                    <div className="form-group" style={{ marginTop: 14 }}>
                      <label className="form-label" style={{ fontSize: '0.82rem' }}>
                        Algum sócio adiantou / pagou a compra inteira na hora? (Antecipação)
                      </label>
                      <select
                        className="form-input"
                        style={{ fontSize: '0.85rem' }}
                        value={paidByPartnerId}
                        onChange={(e) => setPaidByPartnerId(e.target.value)}
                      >
                        <option value="">Nenhum / Pago em conjunto (Todos ficam devendo sua cota ao Caixa)</option>
                        {partners.filter((p) => p.active).map((pt) => (
                          <option key={pt.id} value={pt.id}>
                            {pt.name} pagou o total na hora (Os outros ficam devendo a cota a {pt.name})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="form-group" style={{ marginTop: 16 }}>
                  <label className="form-label">Observações / Nota Fiscal (Opcional)</label>
                  <textarea
                    className="form-input"
                    rows="2"
                    placeholder="Link da nota fiscal, código de rastreio, detalhes técnicos..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPurchaseModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Salvando...' : 'Confirmar Registro de Compra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: QUITAR X PARCELAS NO CARTÃO DE CRÉDITO */}
      {splitModalData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CreditCard size={20} style={{ color: 'var(--accent-indigo)' }} />
                Quitar Parcelas de Cartão
              </h3>
              <button className="modal-close" onClick={() => setSplitModalData(null)}>×</button>
            </div>
            <form onSubmit={handleSettleInstallmentSubmit}>
              <div className="modal-body">
                <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    <strong>Sócio:</strong> {splitModalData.split.partner?.name}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                    <strong>Compra:</strong> {splitModalData.purchase.description} ({splitModalData.purchase.installmentCount}x no Cartão)
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-primary)', paddingTop: 6, marginTop: 6 }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Já quitado: R$ {Number(splitModalData.split.amountPaid || 0).toFixed(2)} ({splitModalData.split.installmentsPaid || 0}/{splitModalData.purchase.installmentCount} parc.)
                    </span>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--accent-indigo)' }}>
                      Cota Total: {formatCurrency(splitModalData.split.amountExpected)}
                    </strong>
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Quantas parcelas quitar agora? (X) *</label>
                    <select
                      className="form-input"
                      value={payInstallmentCountInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPayInstallmentCountInput(val);
                        const totalInst = splitModalData.purchase.installmentCount || 1;
                        const expectedPerInst = Number(splitModalData.split.amountExpected) / totalInst;
                        setPayInstallmentValueInput((Number(val) * expectedPerInst).toFixed(2));
                      }}
                      required
                    >
                      {(() => {
                        const totalInst = splitModalData.purchase.installmentCount || 1;
                        const paidInst = splitModalData.split.installmentsPaid || 0;
                        const remInst = Math.max(1, totalInst - paidInst);
                        return [...Array(remInst)].map((_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1} parcela{i + 1 > 1 ? 's' : ''} {paidInst + i + 1 === totalInst ? '(Quita tudo)' : ''}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Valor do Aporte (Y - R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      value={payInstallmentValueInput}
                      onChange={(e) => setPayInstallmentValueInput(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSplitModalData(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Registrando...' : `Confirmar Quitação (${payInstallmentCountInput}x de ${formatCurrency(payInstallmentValueInput)})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
