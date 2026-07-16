'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Store, Plus, MapPin, Phone, User, DollarSign, Package, Edit, Trash2, X, Rocket, FileText, CreditCard } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

const POINT_TYPES = [
  { value: 'BANCA', label: 'Banca / Quiosque' },
  { value: 'LOJA', label: 'Loja Comercial' },
  { value: 'FEIRA', label: 'Feira / Evento' },
  { value: 'DIRETO', label: 'Cliente Direto (B2C/B2B)' },
];

export default function PontosDeVendaPage() {
  const router = useRouter();
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', type: 'BANCA', address: '', documentId: '', pixKey: '', contactName: '', contactPhone: '', commissionPct: '15', notes: '',
  });

  const fetchPoints = useCallback(async () => {
    try {
      const res = await fetch('/api/sales-points');
      const data = await res.json();
      setPoints(Array.isArray(data) ? data : []);
    } catch { setPoints([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPoints(); }, [fetchPoints]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', type: 'BANCA', address: '', documentId: '', pixKey: '', contactName: '', contactPhone: '', commissionPct: '15', notes: '' });
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name || '',
      type: p.type || 'BANCA',
      address: p.address || p.location || '',
      documentId: p.documentId || '',
      pixKey: p.pixKey || '',
      contactName: p.contactName || '',
      contactPhone: p.contactPhone || '',
      commissionPct: p.commissionPct || '15',
      notes: p.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.contactName || !form.contactPhone) {
      alert('Nome do Comércio, Nome do Contato e Meio de Contato são obrigatórios!');
      return;
    }
    const method = editing ? 'PUT' : 'POST';
    const payload = {
      ...form,
      location: form.address, // manter compatibilidade com location
    };
    const body = editing ? { id: editing.id, ...payload } : payload;
    await fetch('/api/sales-points', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setShowModal(false);
    fetchPoints();
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover este ponto de venda / cliente?')) return;
    await fetch(`/api/sales-points?id=${id}`, { method: 'DELETE' });
    fetchPoints();
  };

  const startNewSale = (p) => {
    router.push(`/vendas?clientId=${p.id}&clientName=${encodeURIComponent(p.name)}`);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pontos de Venda & Clientes (CRM)</h1>
          <p className="page-subtitle">Cadastre parceiros, bancas e clientes para gerenciar consignações ou iniciar vendas rápidas</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Novo Comércio / Cliente</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
      ) : points.length === 0 ? (
        <div className="empty-state">
          <Store />
          <div className="empty-state-title">Nenhum ponto ou cliente cadastrado</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 8 }}>
            Cadastre o primeiro parceiro com contato para iniciar remessas ou ordens de produção.
          </p>
        </div>
      ) : (
        <div className="grid-2" style={{ gap: 24 }}>
          {points.map((p) => {
            const typeLabel = POINT_TYPES.find(t => t.value === p.type)?.label || p.type;
            const addressDisplay = p.address || p.location;
            return (
              <div
                key={p.id}
                className="card modern-crm-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  background: 'linear-gradient(145deg, rgba(26, 34, 52, 0.75) 0%, rgba(15, 23, 42, 0.92) 100%)',
                  border: '1px solid rgba(129, 140, 248, 0.22)',
                  borderRadius: '16px',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.5), 0 0 20px rgba(129, 140, 248, 0.05)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  padding: '24px',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.borderColor = 'rgba(129, 140, 248, 0.45)';
                  e.currentTarget.style.boxShadow = '0 16px 36px -10px rgba(0, 0, 0, 0.6), 0 0 25px rgba(129, 140, 248, 0.15)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'rgba(129, 140, 248, 0.22)';
                  e.currentTarget.style.boxShadow = '0 10px 30px -10px rgba(0, 0, 0, 0.5), 0 0 20px rgba(129, 140, 248, 0.05)';
                }}
              >
                {/* Linha decorativa no topo do card com gradiente */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #818cf8 0%, #22d3ee 50%, #34d399 100%)',
                }} />

                <div>
                  {/* Cabeçalho do Card */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div style={{ flex: 1, paddingRight: 12 }}>
                      <span
                        style={{
                          background: 'rgba(129, 140, 248, 0.15)',
                          color: '#a5b4fc',
                          border: '1px solid rgba(129, 140, 248, 0.35)',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          display: 'inline-block',
                          marginBottom: 10,
                        }}
                      >
                        {typeLabel}
                      </span>
                      <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#ffffff', marginBottom: 6, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                        {p.name}
                      </h3>
                      {addressDisplay && (
                        <div style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MapPin size={14} style={{ color: '#818cf8', flexShrink: 0 }} />
                          <span>{addressDisplay}</span>
                        </div>
                      )}
                    </div>
                    <div className="actions-row" style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-ghost btn-sm btn-icon"
                        style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 8, padding: 6 }}
                        onClick={() => openEdit(p)}
                        title="Editar"
                      >
                        <Edit size={14} style={{ color: '#cbd5e1' }} />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm btn-icon"
                        style={{ background: 'rgba(251, 113, 133, 0.1)', border: '1px solid rgba(251, 113, 133, 0.2)', borderRadius: 8, padding: 6 }}
                        onClick={() => handleDelete(p.id)}
                        title="Excluir"
                      >
                        <Trash2 size={14} style={{ color: '#fb7185' }} />
                      </button>
                    </div>
                  </div>

                  {/* Chips de Contato Modernos */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '18px 0' }}>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}>
                      <div style={{
                        background: 'rgba(129, 140, 248, 0.15)',
                        color: '#818cf8',
                        width: 34,
                        height: 34,
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <User size={16} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>Contato *</div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.contactName || 'Não informado'}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}>
                      <div style={{
                        background: 'rgba(34, 211, 238, 0.15)',
                        color: '#22d3ee',
                        width: 34,
                        height: 34,
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Phone size={16} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>Meio de Contato *</div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#38bdf8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.contactPhone || 'Não informado'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {(p.documentId || p.pixKey) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: '0.78rem', color: '#94a3b8', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '8px', marginBottom: 16 }}>
                      {p.documentId && <div><strong style={{ color: '#cbd5e1' }}>CNPJ/CPF:</strong> {p.documentId}</div>}
                      {p.pixKey && <div><strong style={{ color: '#cbd5e1' }}>PIX:</strong> {p.pixKey}</div>}
                    </div>
                  )}

                  {/* Indicadores KPI do Ponto (Peças e Faturamento) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid rgba(129, 140, 248, 0.12)',
                    borderRadius: '14px',
                    padding: '14px',
                    marginBottom: 16,
                  }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginBottom: 4 }}>Peças em Consignação</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: p.activeItemsCount > 0 ? '#818cf8' : '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Package size={18} style={{ color: '#818cf8' }} />
                        <span>{p.activeItemsCount || 0} unid.</span>
                      </div>
                    </div>
                    <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', paddingLeft: 12 }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginBottom: 4 }}>Faturamento do Ponto</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <DollarSign size={18} style={{ color: '#34d399' }} />
                        <span>{formatCurrency(p.totalRevenue || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rodapé do Card com Botão Gradiente Premium */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', gap: 12 }}>
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    color: '#cbd5e1',
                    fontWeight: 500,
                  }}>
                    Comissão: <strong style={{ color: '#ffffff' }}>{Number(p.commissionPct)}%</strong>
                  </div>
                  <button
                    className="btn btn-sm"
                    style={{
                      background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                      border: 'none',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontWeight: 600,
                      padding: '8px 16px',
                      borderRadius: '10px',
                      boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.55)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 15px rgba(99, 102, 241, 0.35)';
                    }}
                    onClick={() => startNewSale(p)}
                  >
                    <Rocket size={15} />
                    <span>Iniciar Nova Venda</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar Ponto / Cliente' : 'Cadastro Detalhado de Comércio'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="alert alert-info" style={{ marginBottom: 16, fontSize: '0.85rem' }}>
                  Campos marcados com (*) são <strong>obrigatórios</strong> para o CRM. Demais informações adicionais são opcionais.
                </div>

                {/* DADOS PRINCIPAIS OBRIGATÓRIOS */}
                <div className="form-group">
                  <label className="form-label">Nome do Comércio ou Cliente *</label>
                  <input className="form-input" placeholder="ex: Loja Geek da Praça, Maria da Silva (B2C)..." value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nome do Contato / Responsável *</label>
                    <input className="form-input" placeholder="ex: Seu João, Ana..." value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Meio de Contato (WhatsApp / E-mail) *</label>
                    <input className="form-input" placeholder="(11) 99999-9999 ou email@exemplo.com" value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} required />
                  </div>
                </div>

                {/* DADOS ADICIONAIS CABÍVEIS (OPCIONAIS) */}
                <div style={{ margin: '16px 0', borderTop: '1px solid var(--border-primary)', paddingTop: 16 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Informações Adicionais / Fiscais (Opcionais)</div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Tipo de Relacionamento</label>
                      <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                        {POINT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Comissão Padrão (%)</label>
                      <input className="form-input" type="number" step="0.1" value={form.commissionPct} onChange={e => setForm({ ...form, commissionPct: e.target.value })} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Endereço Completo</label>
                    <input className="form-input" placeholder="ex: Av. Brasil, 1200 - Bairro Centro" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">CNPJ ou CPF</label>
                      <input className="form-input" placeholder="00.000.000/0001-00" value={form.documentId} onChange={e => setForm({ ...form, documentId: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Chave PIX (Para repasses/acertos)</label>
                      <input className="form-input" placeholder="CNPJ, E-mail ou Celular PIX" value={form.pixKey} onChange={e => setForm({ ...form, pixKey: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Observações e Preferências</label>
                  <textarea className="form-textarea" placeholder="Horários de funcionamento, regras do expositor, notas para entrega..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Salvar Alterações' : 'Cadastrar Comércio'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
