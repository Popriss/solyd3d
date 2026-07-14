'use client';
import { useState, useEffect, useCallback } from 'react';
import { Store, Plus, MapPin, Phone, User, DollarSign, Package, Edit, Trash2, X } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

const POINT_TYPES = [
  { value: 'BANCA', label: 'Banca / Quiosque' },
  { value: 'LOJA', label: 'Loja Comercial' },
  { value: 'FEIRA', label: 'Feira / Evento' },
  { value: 'DIRETO', label: 'Venda Direta (Balcão/WhatsApp)' },
];

export default function PontosDeVendaPage() {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', type: 'BANCA', location: '', contactName: '', contactPhone: '', commissionPct: '15', notes: '',
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
    setForm({ name: '', type: 'BANCA', location: '', contactName: '', contactPhone: '', commissionPct: '15', notes: '' });
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name, type: p.type || 'BANCA', location: p.location || '', contactName: p.contactName || '',
      contactPhone: p.contactPhone || '', commissionPct: p.commissionPct || '15', notes: p.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const method = editing ? 'PUT' : 'POST';
    const body = editing ? { id: editing.id, ...form } : form;
    await fetch('/api/sales-points', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setShowModal(false);
    fetchPoints();
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover este ponto de venda? Todas as remessas antigas dele serão excluídas.')) return;
    await fetch(`/api/sales-points?id=${id}`, { method: 'DELETE' });
    fetchPoints();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Comércios & Bancas</h1>
          <p className="page-subtitle">Gerencie os pontos locais onde suas peças estão em consignação</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Novo Comércio</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
      ) : points.length === 0 ? (
        <div className="empty-state">
          <Store />
          <div className="empty-state-title">Nenhum ponto de venda cadastrado</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 8 }}>
            Cadastre bancas, lojas ou feiras para começar a controlar as remessas e comissões.
          </p>
        </div>
      ) : (
        <div className="grid-2">
          {points.map((p) => {
            const typeLabel = POINT_TYPES.find(t => t.value === p.type)?.label || p.type;
            return (
              <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <span className="badge badge-indigo" style={{ marginBottom: 8, display: 'inline-block' }}>{typeLabel}</span>
                      <h3 className="card-title" style={{ fontSize: '1.25rem', marginBottom: 4 }}>{p.name}</h3>
                      {p.location && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={14} /> {p.location}</div>}
                    </div>
                    <div className="actions-row">
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(p)}><Edit size={14} /></button>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(p.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '12px 0', borderTop: '1px solid var(--border-primary)', borderBottom: '1px solid var(--border-primary)', margin: '12px 0' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Peças Expostas (Agora)</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 600, color: p.activeItemsCount > 0 ? 'var(--accent-indigo)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Package size={16} /> {p.activeItemsCount || 0} unid.
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Faturamento Acumulado</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <DollarSign size={16} /> {formatCurrency(p.totalRevenue || 0)}
                      </div>
                    </div>
                  </div>

                  {(p.contactName || p.contactPhone) && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                      {p.contactName && <span style={{ marginRight: 12 }}><User size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />{p.contactName}</span>}
                      {p.contactPhone && <span><Phone size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />{p.contactPhone}</span>}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', paddingTop: 10 }}>
                  <span>Comissão da Banca: <strong>{Number(p.commissionPct)}%</strong></span>
                  <span>{p.consignmentsCount || 0} remessas enviadas</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar Comércio' : 'Novo Comércio / Banca'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nome do Comércio / Ponto de Venda</label>
                  <input className="form-input" placeholder="ex: Banca da Praça Central, Loja Geek..." value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Tipo de Ponto</label>
                    <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                      {POINT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Comissão / Acerto (%)</label>
                    <input className="form-input" type="number" step="0.1" value={form.commissionPct} onChange={e => setForm({ ...form, commissionPct: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Endereço / Localização</label>
                  <input className="form-input" placeholder="ex: Av. Brasil, 1200 - Centro" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nome do Responsável</label>
                    <input className="form-input" placeholder="ex: Seu João" value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">WhatsApp / Telefone</label>
                    <input className="form-input" placeholder="(11) 99999-9999" value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Observações sobre o Acerto</label>
                  <textarea className="form-textarea" placeholder="Dias preferidos para acerto, detalhes do expositor..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Salvar Alterações' : 'Cadastrar Ponto'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
