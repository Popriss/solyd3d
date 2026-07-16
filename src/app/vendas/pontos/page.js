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
        <div className="grid-2">
          {points.map((p) => {
            const typeLabel = POINT_TYPES.find(t => t.value === p.type)?.label || p.type;
            const addressDisplay = p.address || p.location;
            return (
              <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--border-primary)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <span className="badge badge-indigo" style={{ marginBottom: 8, display: 'inline-block' }}>{typeLabel}</span>
                      <h3 className="card-title" style={{ fontSize: '1.3rem', marginBottom: 4 }}>{p.name}</h3>
                      {addressDisplay && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <MapPin size={14} style={{ flexShrink: 0 }} /> {addressDisplay}
                        </div>
                      )}
                    </div>
                    <div className="actions-row">
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(p)} title="Editar"><Edit size={14} /></button>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(p.id)} title="Excluir"><Trash2 size={14} /></button>
                    </div>
                  </div>

                  {/* Informações de Contato e Financeiras */}
                  <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, margin: '12px 0', border: '1px solid var(--border-primary)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.85rem' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Contato Responsável *</div>
                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-primary)' }}>
                          <User size={14} /> {p.contactName || 'Não informado'}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Meio de Contato *</div>
                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-indigo)' }}>
                          <Phone size={14} /> {p.contactPhone || 'Não informado'}
                        </div>
                      </div>
                    </div>

                    {(p.documentId || p.pixKey) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '0.8rem', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-primary)' }}>
                        {p.documentId && <div><span style={{ color: 'var(--text-muted)' }}>CNPJ/CPF:</span> {p.documentId}</div>}
                        {p.pixKey && <div><span style={{ color: 'var(--text-muted)' }}>Chave PIX:</span> {p.pixKey}</div>}
                      </div>
                    )}
                  </div>

                  {/* Resumo de Consignações e Comissões */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '8px 0', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Peças em Consignação</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 600, color: p.activeItemsCount > 0 ? 'var(--accent-indigo)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Package size={16} /> {p.activeItemsCount || 0} unid.
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Faturamento do Ponto</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <DollarSign size={16} /> {formatCurrency(p.totalRevenue || 0)}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border-primary)', gap: 12 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Comissão: <strong style={{ color: 'var(--text-primary)' }}>{Number(p.commissionPct)}%</strong>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ background: 'var(--accent-indigo)', borderColor: 'var(--accent-indigo)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
                    onClick={() => startNewSale(p)}
                  >
                    <Rocket size={14} /> Iniciar Nova Venda
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
