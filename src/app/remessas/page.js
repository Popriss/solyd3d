'use client';
import { useState, useEffect, useCallback } from 'react';
import { ShoppingBag, Plus, Calendar, CheckCircle2, AlertCircle, RefreshCw, DollarSign, Package, X, Edit3, Check } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';

export default function RemessasPage() {
  const [consignments, setConsignments] = useState([]);
  const [salesPoints, setSalesPoints] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restockingId, setRestockingId] = useState(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedConsignment, setSelectedConsignment] = useState(null);

  // Forms
  const [createForm, setCreateForm] = useState({ salesPointId: '', deliveryDate: '', notes: '' });
  const [createItems, setCreateItems] = useState([{ productId: '', quantitySent: '1', unitPrice: '' }]);
  const [settleItems, setSettleItems] = useState([]);
  const [settleNotes, setSettleNotes] = useState('');

  // Inline edit state para item preço/custo
  const [editingItem, setEditingItem] = useState(null); // { itemId, unitPrice, costPrice }

  const fetchData = useCallback(async () => {
    try {
      const [cRes, spRes, pRes] = await Promise.all([
        fetch('/api/consignments'),
        fetch('/api/sales-points'),
        fetch('/api/products'),
      ]);
      setConsignments(await cRes.json().then(d => Array.isArray(d) ? d : []));
      setSalesPoints(await spRes.json().then(d => Array.isArray(d) ? d : []));
      setProducts(await pRes.json().then(d => Array.isArray(d) ? d : []));
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setCreateForm({ salesPointId: salesPoints[0]?.id || '', deliveryDate: new Date().toISOString().slice(0, 10), notes: '' });
    setCreateItems([{ productId: products[0]?.id || '', quantitySent: '1', unitPrice: '25.00' }]);
    setShowCreateModal(true);
  };

  const handleCreateItemChange = (idx, field, val) => {
    const copy = [...createItems];
    copy[idx][field] = val;
    if (field === 'productId') {
      const prod = products.find(p => p.id === Number(val));
      if (prod) {
        copy[idx].unitPrice = prod.salePrice || '25.00';
      }
    }
    setCreateItems(copy);
  };

  const addCreateItemRow = () => {
    setCreateItems([...createItems, { productId: products[0]?.id || '', quantitySent: '1', unitPrice: '25.00' }]);
  };

  const removeCreateItemRow = (idx) => {
    if (createItems.length <= 1) return;
    setCreateItems(createItems.filter((_, i) => i !== idx));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    await fetch('/api/consignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...createForm,
        items: createItems.map(i => ({
          productId: Number(i.productId),
          quantitySent: Number(i.quantitySent),
          unitPrice: Number(i.unitPrice),
        })),
      }),
    });
    setShowCreateModal(false);
    fetchData();
  };

  const openSettle = (c) => {
    setSelectedConsignment(c);
    setSettleNotes(c.notes || '');
    setSettleItems(c.items.map(i => ({
      id: i.id,
      productId: i.productId,
      productName: i.product?.name || 'Peça',
      quantitySent: i.quantitySent,
      unitPrice: i.unitPrice,
      quantitySold: i.quantitySold || 0,
      quantityReturned: i.quantityReturned || 0,
      quantityLost: i.quantityLost || 0,
    })));
    setShowSettleModal(true);
  };

  const handleSettleItemChange = (idx, field, val) => {
    const copy = [...settleItems];
    copy[idx][field] = Number(val);
    setSettleItems(copy);
  };

  const handleSettleSubmit = async (e) => {
    e.preventDefault();
    await fetch('/api/consignments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedConsignment.id,
        notes: settleNotes,
        items: settleItems.map(i => ({
          id: i.id,
          quantitySold: i.quantitySold,
          quantityReturned: i.quantityReturned,
          quantityLost: i.quantityLost,
        })),
      }),
    });
    setShowSettleModal(false);
    fetchData();
  };

  const handleRestock = async (c) => {
    if (!confirm(`Deseja acionar a reposição "Encher Estoque" para ${c.salesPoint?.name || 'este ponto'}?\nO sistema calculará o déficit e gerará automaticamente Ordens de Produção (OP) na fila.`)) return;
    setRestockingId(c.id);
    try {
      const res = await fetch('/api/consignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, action: 'RESTOCK' }),
      });
      const data = await res.json();
      if (data.error) {
        alert('Erro ao gerar reestoque: ' + data.error);
      } else {
        alert(`🎯 Encher Estoque acionado com sucesso!\n${data.generatedOps?.length || 0} Ordem(ns) de Produção foram adicionadas à fila para repor as peças vendidas em ${c.salesPoint?.name}.`);
        fetchData();
      }
    } catch {
      alert('Falha na comunicação ao tentar encher estoque.');
    } finally {
      setRestockingId(null);
    }
  };

  const saveInlinePriceCost = async (itemId) => {
    if (!editingItem) return;
    await fetch('/api/consignments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedConsignment?.id || consignments[0]?.id || 1,
        action: 'UPDATE_ITEM_PRICE',
        itemId: Number(itemId),
        unitPrice: editingItem.unitPrice,
        costPrice: editingItem.costPrice,
      }),
    });
    setEditingItem(null);
    fetchData();
  };

  const deleteConsignment = async (id) => {
    if (!confirm('Excluir esta remessa do histórico?')) return;
    await fetch(`/api/consignments?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Remessas & Acertos (Consignação)</h1>
          <p className="page-subtitle">Acompanhe mercadorias em bancas, ajuste preços/custos livremente e reponha peças com "Encher Estoque"</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate} disabled={salesPoints.length === 0 || products.length === 0}>
          <Plus size={16} /> Nova Remessa / Consignação
        </button>
      </div>

      {(salesPoints.length === 0 || products.length === 0) && (
        <div className="alert alert-warning" style={{ marginBottom: 24 }}>
          <AlertCircle size={18} />
          <div>Para criar remessas, você precisa ter pelo menos <strong>1 Ponto de Venda</strong> e <strong>1 Produto</strong> cadastrado.</div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
      ) : consignments.length === 0 ? (
        <div className="empty-state">
          <ShoppingBag />
          <div className="empty-state-title">Nenhuma remessa em consignação</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 8 }}>
            Envie pacotes de peças para feiras, bancas ou parceiros para gerenciar o acerto periódico.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {consignments.map((c) => {
            const isSettled = c.status === 'SETTLED';
            const isPartial = c.status === 'PARTIAL';
            return (
              <div key={c.id} className="card" style={{ padding: 20, border: '1px solid var(--border-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span className={`badge ${isSettled ? 'badge-emerald' : isPartial ? 'badge-indigo' : 'badge-amber'}`}>
                        {isSettled ? '100% Acertado' : isPartial ? 'Acerto Parcial' : 'Pendente na Banca'}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={14} /> Enviado em: {formatDate(c.deliveryDate)}
                      </span>
                    </div>
                    <h3 className="card-title" style={{ fontSize: '1.3rem' }}>{c.salesPoint?.name || 'Comércio'}</h3>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Comissão do ponto: {Number(c.salesPoint?.commissionPct || 0)}%</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isSettled ? 'Valor Real Recebido' : 'Valor Total Esperado'}</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: isSettled ? 'var(--accent-emerald)' : 'var(--text-primary)' }}>
                        {formatCurrency(isSettled || isPartial ? c.totalSettled : c.totalExpected)}
                      </div>
                      {(isSettled || isPartial) && Number(c.totalProfit) !== 0 && (
                        <div style={{ fontSize: '0.8rem', color: Number(c.totalProfit) >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                          Lucro Limpo: {formatCurrency(c.totalProfit)}
                        </div>
                      )}
                    </div>

                    <div className="actions-row" style={{ flexWrap: 'wrap', gap: 8 }}>
                      {!isSettled && (
                        <button className="btn btn-primary btn-sm" onClick={() => openSettle(c)}>
                          <CheckCircle2 size={14} /> Fazer Acerto
                        </button>
                      )}
                      <button
                        className="btn btn-sm"
                        style={{ background: 'var(--accent-amber)', color: '#000', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, border: 'none' }}
                        onClick={() => handleRestock(c)}
                        disabled={restockingId === c.id}
                      >
                        <RefreshCw size={14} className={restockingId === c.id ? 'spin' : ''} /> Encher Estoque
                      </button>
                      {isSettled && (
                        <button className="btn btn-ghost btn-sm" onClick={() => openSettle(c)}>Ver Detalhes</button>
                      )}
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => deleteConsignment(c.id)} title="Remover"><X size={14} /></button>
                    </div>
                  </div>
                </div>

                {/* Itens da Consignação com edição livre de Preço/Custo na linha */}
                <div style={{ marginTop: 16, borderTop: '1px solid var(--border-primary)', paddingTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Itens em Consignação (Clique no ícone ✏️ para ajustar preço/custo do item sem afetar o catálogo):</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                    {c.items.map((item) => {
                      const isEditingThis = editingItem?.itemId === item.id;
                      return (
                        <div key={item.id} style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, fontSize: '0.85rem', border: '1px solid var(--border-primary)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.product?.name || 'Peça'}</div>
                            {!isEditingThis ? (
                              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setEditingItem({ itemId: item.id, unitPrice: item.unitPrice, costPrice: item.costPrice })} title="Alterar Preço/Custo deste item">
                                <Edit3 size={14} />
                              </button>
                            ) : (
                              <button className="btn btn-primary btn-sm btn-icon" style={{ background: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)' }} onClick={() => saveInlinePriceCost(item.id)} title="Salvar">
                                <Check size={14} />
                              </button>
                            )}
                          </div>

                          {!isEditingThis ? (
                            <div style={{ color: 'var(--text-secondary)', marginTop: 6 }}>
                              Enviados: <strong>{item.quantitySent}</strong> unid. × {formatCurrency(item.unitPrice)}
                              {Number(item.costPrice) > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 6 }}>(Custo: {formatCurrency(item.costPrice)})</span>}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                              <div>
                                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Preço Venda</label>
                                <input
                                  className="form-input"
                                  style={{ width: 85, padding: '4px 6px', fontSize: '0.8rem' }}
                                  type="number" step="0.1"
                                  value={editingItem.unitPrice}
                                  onChange={e => setEditingItem({ ...editingItem, unitPrice: e.target.value })}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Custo Unit.</label>
                                <input
                                  className="form-input"
                                  style={{ width: 85, padding: '4px 6px', fontSize: '0.8rem' }}
                                  type="number" step="0.1"
                                  value={editingItem.costPrice}
                                  onChange={e => setEditingItem({ ...editingItem, costPrice: e.target.value })}
                                />
                              </div>
                            </div>
                          )}

                          {(isSettled || isPartial || item.quantitySold > 0 || item.quantityReturned > 0) && (
                            <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: 6, borderTop: '1px solid var(--border-primary)' }}>
                              <span style={{ color: 'var(--accent-emerald)' }}>Vendidos: {item.quantitySold}</span>
                              <span style={{ color: 'var(--accent-indigo)' }}>Devolvidos: {item.quantityReturned}</span>
                              {item.quantityLost > 0 && <span style={{ color: 'var(--accent-rose)' }}>Perdidos: {item.quantityLost}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL NOVA CONSIGNAÇÃO */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nova Remessa / Consignação</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Ponto de Venda / Comércio</label>
                    <select className="form-select" value={createForm.salesPointId} onChange={e => setCreateForm({ ...createForm, salesPointId: e.target.value })} required>
                      {salesPoints.map(sp => <option key={sp.id} value={sp.id}>{sp.name} ({Number(sp.commissionPct)}% comissão)</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Data de Envio</label>
                    <input className="form-input" type="date" value={createForm.deliveryDate} onChange={e => setCreateForm({ ...createForm, deliveryDate: e.target.value })} required />
                  </div>
                </div>

                <div style={{ margin: '16px 0', borderTop: '1px solid var(--border-primary)', paddingTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Peças e Quantidades Enviadas</label>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={addCreateItemRow}><Plus size={14} /> Adicionar outro produto</button>
                  </div>

                  {createItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <select className="form-select" value={item.productId} onChange={e => handleCreateItemChange(idx, 'productId', e.target.value)} required>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} (Prontos: {p.stockReady || 0})</option>)}
                        </select>
                      </div>
                      <div>
                        <input className="form-input" type="number" min="1" placeholder="Qtd" value={item.quantitySent} onChange={e => handleCreateItemChange(idx, 'quantitySent', e.target.value)} required />
                      </div>
                      <div>
                        <input className="form-input" type="number" step="0.01" placeholder="Preço (R$)" value={item.unitPrice} onChange={e => handleCreateItemChange(idx, 'unitPrice', e.target.value)} required />
                      </div>
                      {createItems.length > 1 && (
                        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => removeCreateItemRow(idx)}><X size={14} /></button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="form-group">
                  <label className="form-label">Anotações / Instruções da Remessa</label>
                  <textarea className="form-textarea" placeholder="ex: Peças deixadas na vitrine frontal..." value={createForm.notes} onChange={e => setCreateForm({ ...createForm, notes: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar Remessa</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ACERTO DA CONSIGNAÇÃO */}
      {showSettleModal && selectedConsignment && (
        <div className="modal-overlay" onClick={() => setShowSettleModal(false)}>
          <div className="modal" style={{ maxWidth: 650 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Acerto de Mercadoria — {selectedConsignment.salesPoint?.name}</h2>
              <button className="modal-close" onClick={() => setShowSettleModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSettleSubmit}>
              <div className="modal-body">
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                  Informe a contagem real na banca: o que foi vendido entra no caixa, o que foi devolvido volta ao estoque pronto e perdas são deduzidas.
                </p>

                <table className="data-table" style={{ marginBottom: 16 }}>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Enviados</th>
                      <th>Vendidos</th>
                      <th>Devolvidos</th>
                      <th>Perdas / Quebrados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settleItems.map((item, idx) => (
                      <tr key={item.id}>
                        <td><strong>{item.productName}</strong><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatCurrency(item.unitPrice)} cada</div></td>
                        <td>{item.quantitySent} unid.</td>
                        <td><input className="form-input" style={{ width: 80 }} type="number" min="0" max={item.quantitySent} value={item.quantitySold} onChange={e => handleSettleItemChange(idx, 'quantitySold', e.target.value)} /></td>
                        <td><input className="form-input" style={{ width: 80 }} type="number" min="0" max={item.quantitySent} value={item.quantityReturned} onChange={e => handleSettleItemChange(idx, 'quantityReturned', e.target.value)} /></td>
                        <td><input className="form-input" style={{ width: 80 }} type="number" min="0" max={item.quantitySent} value={item.quantityLost} onChange={e => handleSettleItemChange(idx, 'quantityLost', e.target.value)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="form-group">
                  <label className="form-label">Anotações do Acerto</label>
                  <textarea className="form-textarea" placeholder="Observações finais sobre o fechamento..." value={settleNotes} onChange={e => setSettleNotes(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowSettleModal(false)}>Fechar</button>
                <button type="submit" className="btn btn-primary">Concluir e Salvar Acerto</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
