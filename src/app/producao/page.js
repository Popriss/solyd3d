'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Factory, CheckCircle, XCircle, Clock, PlayCircle,
  X, AlertTriangle, Trash2
} from 'lucide-react';
import { formatCurrency, formatWeight, formatDuration, formatDateTime, orderStatusLabels } from '@/lib/formatters';

const statusBadgeMap = {
  QUEUED: 'badge-cyan',
  PRINTING: 'badge-indigo',
  COMPLETED: 'badge-emerald',
  FAILED: 'badge-rose',
};

const statusIcons = {
  QUEUED: Clock,
  PRINTING: PlayCircle,
  COMPLETED: CheckCircle,
  FAILED: XCircle,
};

export default function ProducaoPage() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [rolls, setRolls] = useState([]);
  const [machines, setMachines] = useState([]);
  const [salesPoints, setSalesPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [form, setForm] = useState({ productId: '', filamentRollId: '', machineId: '', quantity: '1', destinationType: 'DIRECT_SALE', destinationName: '', notes: '' });
  const [statusForm, setStatusForm] = useState({ status: '', actualWeightG: '', actualPrintMinutes: '' });

  const fetchAll = useCallback(async () => {
    try {
      const [ordersRes, productsRes, rollsRes, machinesRes, spRes] = await Promise.all([
        fetch('/api/production-orders'),
        fetch('/api/products'),
        fetch('/api/filament-rolls'),
        fetch('/api/machines'),
        fetch('/api/sales-points'),
      ]);
      setOrders(await ordersRes.json().then(d => Array.isArray(d) ? d : []));
      setProducts(await productsRes.json().then(d => Array.isArray(d) ? d : []));
      setRolls(await rollsRes.json().then(d => Array.isArray(d) ? d : []));
      setMachines(await machinesRes.json().then(d => Array.isArray(d) ? d : []));
      setSalesPoints(await spRes.json().then(d => Array.isArray(d) ? d : []));
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async (e) => {
    e.preventDefault();
    await fetch('/api/production-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setShowModal(false);
    fetchAll();
  };

  const openStatusUpdate = (order) => {
    setSelectedOrder(order);
    const nextStatus = order.status === 'QUEUED' ? 'PRINTING' : order.status === 'PRINTING' ? 'COMPLETED' : '';
    setStatusForm({
      status: nextStatus,
      actualWeightG: order.product?.estimatedWeightG || '',
      actualPrintMinutes: order.product?.estimatedPrintMinutes || '',
    });
    setShowStatusModal(true);
  };

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    await fetch('/api/production-orders', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedOrder.id, ...statusForm }),
    });
    setShowStatusModal(false);
    fetchAll();
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover esta ordem de produção?')) return;
    await fetch(`/api/production-orders?id=${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const completed = orders.filter(o => o.status === 'COMPLETED').length;
  const failed = orders.filter(o => o.status === 'FAILED').length;
  const printing = orders.filter(o => o.status === 'PRINTING').length;
  const availableRolls = rolls.filter(r => r.active !== false);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Controle de Produção</h1>
          <p className="page-subtitle">Ordens de impressão e acompanhamento (Modelo Sem Baixa de Gramas)</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ productId: '', filamentRollId: '', machineId: '', notes: '' }); setShowModal(true); }}>
          <Plus size={16} /> Nova Ordem
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card indigo">
          <div className="stat-card-header"><div className="stat-card-icon indigo"><Factory size={20} /></div></div>
          <div className="stat-card-label">Total de Ordens</div>
          <div className="stat-card-value">{orders.length}</div>
        </div>
        <div className="stat-card cyan">
          <div className="stat-card-header"><div className="stat-card-icon cyan"><PlayCircle size={20} /></div></div>
          <div className="stat-card-label">Imprimindo Agora</div>
          <div className="stat-card-value">{printing}</div>
        </div>
        <div className="stat-card emerald">
          <div className="stat-card-header"><div className="stat-card-icon emerald"><CheckCircle size={20} /></div></div>
          <div className="stat-card-label">Finalizadas</div>
          <div className="stat-card-value">{completed}</div>
        </div>
        <div className="stat-card rose">
          <div className="stat-card-header"><div className="stat-card-icon rose"><XCircle size={20} /></div></div>
          <div className="stat-card-label">Falhas</div>
          <div className="stat-card-value">{failed}</div>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Produto</th>
              <th>Qtd & Destino</th>
              <th>Filamento Ativo</th>
              <th>Máquina</th>
              <th>Custo Calc.</th>
              <th>Status</th>
              <th>Data</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }}></div></td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan="9">
                <div className="empty-state">
                  <Factory />
                  <div className="empty-state-title">Nenhuma ordem de produção registrada</div>
                  <div className="empty-state-text">Clique em "Nova Ordem" para registrar uma impressão</div>
                </div>
              </td></tr>
            ) : orders.map(order => {
              const StatusIcon = statusIcons[order.status] || Clock;
              const destBadge = order.destinationType === 'SALES_POINT' ? 'badge-indigo' : order.destinationType === 'ORDER' ? 'badge-cyan' : 'badge-amber';
              const destLabel = order.destinationName || (order.destinationType === 'SALES_POINT' ? 'Ponto de Venda' : order.destinationType === 'ORDER' ? 'Encomenda' : 'Venda Avulsa / Estoque');
              return (
                <tr key={order.id}>
                  <td><strong>#{order.id}</strong></td>
                  <td>
                    <strong>{order.product?.name || `Produto #${order.productId}`}</strong>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {formatWeight(order.actualWeightG || order.product?.estimatedWeightG)} — {formatDuration(order.actualPrintMinutes || order.product?.estimatedPrintMinutes)}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>{order.quantity || 1} unid.</div>
                    <span className={`badge ${destBadge}`} style={{ fontSize: '0.75rem', display: 'inline-block' }}>
                      📍 {destLabel}
                    </span>
                    {order.saleId && (
                      <div style={{ marginTop: 6 }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.75rem',
                            background: 'rgba(129, 140, 248, 0.15)',
                            color: '#818cf8',
                            border: '1px solid rgba(129, 140, 248, 0.35)',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                          onClick={() => router.push(`/vendas?saleId=${order.saleId}`)}
                          title="Clique para ver este pedido na aba de Vendas Diretas"
                        >
                          🛍️ Venda #{order.saleId}
                        </button>
                      </div>
                    )}
                  </td>
                  <td>
                    {order.filamentRoll ? (
                      <div>
                        <strong>{order.filamentRoll.material} {order.filamentRoll.color}</strong>
                        <div style={{ fontSize: 12, color: '#818cf8' }}>R$ {Number(order.filamentRoll.costPerGram).toFixed(4)}/g ({order.filamentRoll.brand})</div>
                      </div>
                    ) : '-'}
                  </td>
                  <td>{order.machine?.name || `Máquina #${order.machineId}`}</td>
                  <td>
                    {order.totalCost ? (
                      <div>
                        <strong>{formatCurrency(order.totalCost)}</strong>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Mat: {formatCurrency(order.materialCost)} | En: {formatCurrency(order.energyCost)}</div>
                      </div>
                    ) : '-'}
                  </td>
                  <td>
                    <span className={`badge ${statusBadgeMap[order.status] || 'badge-gray'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <StatusIcon size={12} />
                      {orderStatusLabels[order.status] || order.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: 13 }}>{formatDateTime(order.createdAt)}</div>
                    {order.finishedAt && <div style={{ fontSize: 11, color: '#64748b' }}>Fim: {formatDateTime(order.finishedAt)}</div>}
                  </td>
                  <td>
                    <div className="actions-row">
                      {(order.status === 'QUEUED' || order.status === 'PRINTING') && (
                        <button className="btn btn-ghost btn-sm" onClick={() => openStatusUpdate(order)} title="Atualizar Status">
                          <PlayCircle size={14} />
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(order.id)} title="Remover"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal: Nova Ordem */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nova Ordem de Produção</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                {products.length === 0 && (
                  <div className="alert alert-warning"><AlertTriangle size={16} /><span>Cadastre produtos antes de criar ordens.</span></div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Produto</label>
                    <select className="form-select" value={form.productId} onChange={e => setForm({ ...form, productId: e.target.value })} required>
                      <option value="">Selecionar produto...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} ({formatWeight(p.estimatedWeightG)})</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Quantidade de Peças</label>
                    <input className="form-input" type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Para Quem? (Destino)</label>
                    <select
                      className="form-select"
                      value={form.destinationType}
                      onChange={e => setForm({ ...form, destinationType: e.target.value, destinationName: '' })}
                    >
                      <option value="DIRECT_SALE">🛒 Venda Avulsa / Direta (Por fora)</option>
                      <option value="ORDER">📦 Encomenda / Sob Medida</option>
                      <option value="SALES_POINT">📍 Ponto de Venda Cadastrado</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{form.destinationType === 'SALES_POINT' ? 'Selecione o Ponto de Venda' : 'Nome do Cliente / Destinatário'}</label>
                    {form.destinationType === 'SALES_POINT' ? (
                      <select
                        className="form-select"
                        value={form.destinationName}
                        onChange={e => setForm({ ...form, destinationName: e.target.value })}
                        required
                      >
                        <option value="">Escolher comércio parceiro...</option>
                        {salesPoints.map(sp => <option key={sp.id} value={sp.name}>{sp.name}</option>)}
                      </select>
                    ) : (
                      <input
                        className="form-input"
                        placeholder="ex: Vizinha Maria, Cliente Balcão..."
                        value={form.destinationName}
                        onChange={e => setForm({ ...form, destinationName: e.target.value })}
                        required
                      />
                    )}
                  </div>
                </div>

                {(form.destinationType === 'DIRECT_SALE' || form.destinationType === 'ORDER') && form.destinationName && (
                  <div className="alert alert-info" style={{ marginBottom: 12, fontSize: '0.8rem' }}>
                    💡 <strong>Gatilho Reverso de Venda:</strong> Ao salvar esta OP, o sistema gerará automaticamente uma cobrança para <strong>{form.destinationName}</strong> na aba de <strong>Vendas Diretas</strong> para você não esquecer de receber!
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Filamento (Apenas Filamentos com Status Ativo)</label>
                  <select className="form-select" value={form.filamentRollId} onChange={e => setForm({ ...form, filamentRollId: e.target.value })} required>
                    <option value="">Selecionar filamento ativo...</option>
                    {availableRolls.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.material} {r.color} — {r.brand} (R$ {Number(r.costPerGram).toFixed(4)}/g)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Máquina</label>
                  <select className="form-select" value={form.machineId} onChange={e => setForm({ ...form, machineId: e.target.value })} required>
                    <option value="">Selecionar máquina...</option>
                    {machines.filter(m => m.status === 'ACTIVE').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Observações (opcional)</label>
                  <textarea className="form-textarea" placeholder="Notas sobre esta impressão..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={!form.productId || !form.filamentRollId || !form.machineId}>Criar Ordem</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Atualizar Status */}
      {showStatusModal && selectedOrder && (
        <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Atualizar Ordem #{selectedOrder.id}</h2>
              <button className="modal-close" onClick={() => setShowStatusModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleStatusUpdate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Novo Status</label>
                  <select className="form-select" value={statusForm.status} onChange={e => setStatusForm({ ...statusForm, status: e.target.value })} required>
                    {selectedOrder.status === 'QUEUED' && <option value="PRINTING">▶ Iniciar Impressão</option>}
                    {selectedOrder.status === 'PRINTING' && <>
                      <option value="COMPLETED">✅ Finalizar com Sucesso</option>
                      <option value="FAILED">❌ Registrar Falha</option>
                    </>}
                  </select>
                </div>
                {(statusForm.status === 'COMPLETED' || statusForm.status === 'FAILED') && (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Peso Real (g)</label>
                        <input className="form-input" type="number" step="0.01" value={statusForm.actualWeightG} onChange={e => setStatusForm({ ...statusForm, actualWeightG: e.target.value })} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Tempo Real (min)</label>
                        <input className="form-input" type="number" value={statusForm.actualPrintMinutes} onChange={e => setStatusForm({ ...statusForm, actualPrintMinutes: e.target.value })} required />
                      </div>
                    </div>
                    <div className="alert alert-info" style={{ marginTop: 12 }}>
                      <span>💡 <strong>Custeio Qualitativo:</strong> O custo de material e energia será calculado e salvo para o controle financeiro, sem realizar nenhuma baixa de gramas no filamento.</span>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowStatusModal(false)}>Cancelar</button>
                <button type="submit" className={`btn ${statusForm.status === 'FAILED' ? 'btn-danger' : 'btn-primary'}`}>Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
