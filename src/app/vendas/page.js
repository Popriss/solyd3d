'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShoppingBag, Plus, Calendar, CheckCircle2, AlertCircle, Clock, DollarSign, Package, X, Edit, Trash2, Printer, Upload, FileText, Check, Lock } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/formatters';

function VendasContent() {
  const searchParams = useSearchParams();
  const prefillClientId = searchParams.get('clientId');
  const prefillClientName = searchParams.get('clientName');

  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [salesPoints, setSalesPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ACTIVE'); // ACTIVE, PAID

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);

  // Form de criação/edição
  const [form, setForm] = useState({
    salesPointId: '',
    customerName: '',
    customerContact: '',
    notes: '',
  });
  const [formItems, setFormItems] = useState([{ productId: '', quantity: '1', unitPrice: '' }]);

  // Upload comprovante
  const [proofFileBase64, setProofFileBase64] = useState('');
  const [proofFileName, setProofFileName] = useState('');
  const [proofNotes, setProofNotes] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [sRes, pRes, spRes] = await Promise.all([
        fetch('/api/sales'),
        fetch('/api/products'),
        fetch('/api/sales-points'),
      ]);
      setSales(await sRes.json().then(d => Array.isArray(d) ? d : []));
      const prods = await pRes.json().then(d => Array.isArray(d) ? d : []);
      setProducts(prods);
      const points = await spRes.json().then(d => Array.isArray(d) ? d : []);
      setSalesPoints(points);

      // Se veio parâmetro da URL para iniciar venda (via CRM Pontos de Venda)
      if (prefillClientName && !showCreateModal && prods.length > 0) {
        setForm({
          salesPointId: prefillClientId || '',
          customerName: prefillClientName,
          customerContact: points.find(pt => pt.id === Number(prefillClientId))?.contactPhone || '',
          notes: 'Venda iniciada pelo CRM Pontos de Venda',
        });
        setFormItems([{ productId: prods[0].id, quantity: '1', unitPrice: prods[0].salePrice || '25.00' }]);
        setShowCreateModal(true);
      }
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, [prefillClientId, prefillClientName, showCreateModal]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Handler Nova Venda
  const openCreate = () => {
    setForm({
      salesPointId: '',
      customerName: '',
      customerContact: '',
      notes: '',
    });
    setFormItems([{ productId: products[0]?.id || '', quantity: '1', unitPrice: products[0]?.salePrice || '25.00' }]);
    setShowCreateModal(true);
  };

  const openEdit = (sale) => {
    // Verificar se está travado no frontend
    const isLocked = sale.productionOrders?.some(op => op.status === 'PRINTING' || op.status === 'COMPLETED');
    if (isLocked) {
      alert('🔒 Produção em andamento ou concluída para esta venda!\nImpossível alterar a quantidade ou itens no momento.');
      return;
    }
    setSelectedSale(sale);
    setForm({
      salesPointId: sale.salesPointId || '',
      customerName: sale.customerName || '',
      customerContact: sale.customerContact || '',
      notes: sale.notes || '',
    });
    setFormItems(sale.items?.map(i => ({
      productId: i.productId,
      quantity: String(i.quantity || 1),
      unitPrice: String(i.unitPrice || '25.00'),
    })) || []);
    setShowEditModal(true);
  };

  const handleItemChange = (idx, field, val) => {
    const copy = [...formItems];
    copy[idx][field] = val;
    if (field === 'productId') {
      const prod = products.find(p => p.id === Number(val));
      if (prod) {
        copy[idx].unitPrice = prod.salePrice || '25.00';
      }
    }
    setFormItems(copy);
  };

  const addItemRow = () => {
    setFormItems([...formItems, { productId: products[0]?.id || '', quantity: '1', unitPrice: products[0]?.salePrice || '25.00' }]);
  };

  const removeItemRow = (idx) => {
    if (formItems.length <= 1) return;
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  // Cálculo Oculto para resumo rápido na UI
  const computeHiddenTotals = () => {
    let total = 0;
    let mins = 0;
    formItems.forEach(item => {
      const prod = products.find(p => p.id === Number(item.productId));
      const qty = Number(item.quantity) || 1;
      const price = Number(item.unitPrice) || Number(prod?.salePrice || 0);
      total += price * qty;
      if (prod) {
        mins += (Number(prod.estimatedPrintMinutes) || 60) * qty;
      }
    });
    return { total, mins };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customerName || formItems.length === 0) {
      alert('Nome do cliente e itens são obrigatórios.');
      return;
    }

    const method = showEditModal ? 'PUT' : 'POST';
    const payload = {
      ...(showEditModal ? { id: selectedSale.id, action: 'UPDATE_ITEMS' } : {}),
      salesPointId: form.salesPointId ? Number(form.salesPointId) : null,
      customerName: form.customerName,
      customerContact: form.customerContact,
      notes: form.notes,
      items: formItems.map(i => ({
        productId: Number(i.productId),
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
      })),
    };

    const res = await fetch('/api/sales', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.error) {
      alert('Erro ao salvar venda: ' + data.error);
    } else {
      setShowCreateModal(false);
      setShowEditModal(false);
      fetchData();
    }
  };

  const openProofModal = (sale) => {
    setSelectedSale(sale);
    setProofFileBase64(sale.proofFileUrl || '');
    setProofFileName(sale.proofFileName || '');
    setProofNotes('');
    setShowProofModal(true);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProofFileName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      setProofFileBase64(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleProofSubmit = async (e) => {
    e.preventDefault();
    if (!proofFileBase64) {
      alert('⚠️ Comprovante obrigatório!\nPor favor, anexe uma foto, print ou PDF do pagamento para dar baixa na Venda.');
      return;
    }

    const res = await fetch('/api/sales', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedSale.id,
        action: 'CONFIRM_PAYMENT',
        proofFileUrl: proofFileBase64,
        proofFileName: proofFileName || 'comprovante.png',
        notes: proofNotes ? selectedSale.notes + `\n[Comprovante] ${proofNotes}` : undefined,
      }),
    });

    const data = await res.json();
    if (data.error) {
      alert(data.error);
    } else {
      setShowProofModal(false);
      fetchData();
    }
  };

  const handleDelete = async (sale) => {
    const isLocked = sale.productionOrders?.some(op => op.status === 'PRINTING');
    if (isLocked) {
      alert('Impossível excluir: existe uma Ordem de Produção desta venda em andamento no momento.');
      return;
    }
    if (!confirm(`Deseja cancelar/excluir a Venda #${sale.id} de ${sale.customerName}?`)) return;
    await fetch(`/api/sales?id=${sale.id}`, { method: 'DELETE' });
    fetchData();
  };

  const filteredSales = sales.filter(s => {
    if (activeTab === 'ACTIVE') return s.status === 'ACTIVE';
    return s.status === 'PAID' || s.status === 'CANCELLED';
  });

  const hiddenTotals = computeHiddenTotals();

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Vendas Diretas & Sob Demanda</h1>
          <p className="page-subtitle">Crie pedidos com cálculo oculto, gatilho de Ordem de Produção (OP) automático e baixa com comprovante</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate} disabled={products.length === 0}>
          <Plus size={16} /> Nova Venda Direta
        </button>
      </div>

      {products.length === 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 24 }}>
          <AlertCircle size={18} />
          <div>Para iniciar vendas diretas com disparo de produção, cadastre pelo menos 1 Produto no <strong>Catálogo de Peças</strong>.</div>
        </div>
      )}

      {/* ABAS DA PÁGINA */}
      <div className="tabs-header" style={{ marginBottom: 24 }}>
        <button
          className={`tab-btn ${activeTab === 'ACTIVE' ? 'active' : ''}`}
          onClick={() => setActiveTab('ACTIVE')}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Clock size={16} /> Vendas Ativas & Em Produção ({sales.filter(s => s.status === 'ACTIVE').length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'PAID' ? 'active' : ''}`}
          onClick={() => setActiveTab('PAID')}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <CheckCircle2 size={16} /> Histórico (Quitadas & Comprovadas) ({sales.filter(s => s.status === 'PAID').length})
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
      ) : filteredSales.length === 0 ? (
        <div className="empty-state">
          <ShoppingBag />
          <div className="empty-state-title">{activeTab === 'ACTIVE' ? 'Nenhuma venda ativa em andamento' : 'Nenhuma venda no histórico ainda'}</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 8 }}>
            {activeTab === 'ACTIVE' ? 'Clique em "Nova Venda Direta" para registrar um pedido e enviar para a fila da impressora 3D.' : 'As vendas com pagamento confirmado com comprovante aparecerão aqui.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredSales.map((sale) => {
            const isPaid = sale.status === 'PAID';
            // Verificar status geral das OPs desta venda
            const ops = sale.productionOrders || [];
            const hasPrinting = ops.some(op => op.status === 'PRINTING');
            const hasCompleted = ops.length > 0 && ops.every(op => op.status === 'COMPLETED');
            const opStatusLabel = hasPrinting ? '🖨️ Imprimindo' : hasCompleted ? '✅ Produção Pronta' : ops.length > 0 ? '⏳ Na Fila de Produção' : 'Aguardando OP';
            const opStatusBadge = hasPrinting ? 'badge-amber' : hasCompleted ? 'badge-emerald' : 'badge-indigo';
            const isLockedForEdit = ops.some(op => op.status === 'PRINTING' || op.status === 'COMPLETED');

            const hours = Math.floor((sale.estimatedPrintMinutes || 0) / 60);
            const mins = (sale.estimatedPrintMinutes || 0) % 60;

            return (
              <div key={sale.id} className="card" style={{ padding: 20, border: '1px solid var(--border-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span className="badge" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', fontWeight: 700, color: 'var(--text-primary)' }}>
                        #V-{sale.id}
                      </span>
                      <span className={`badge ${isPaid ? 'badge-emerald' : opStatusBadge}`}>
                        {isPaid ? '💰 Pago / Comprovado' : opStatusLabel}
                      </span>
                      {sale.salesPoint && (
                        <span className="badge badge-indigo" style={{ fontSize: '0.75rem' }}>
                          📍 Ponto: {sale.salesPoint.name}
                        </span>
                      )}
                    </div>
                    <h3 className="card-title" style={{ fontSize: '1.35rem', marginBottom: 4 }}>{sale.customerName}</h3>
                    {sale.customerContact && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>WhatsApp/Contato: {sale.customerContact}</div>}
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Registrado em: {formatDate(sale.createdAt)}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Valor Total da Venda</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: isPaid ? 'var(--accent-emerald)' : 'var(--text-primary)' }}>
                        {formatCurrency(sale.totalAmount)}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 2 }}>
                        <Clock size={13} /> ~{hours > 0 ? `${hours}h ` : ''}{mins}min de impressão
                      </div>
                    </div>

                    <div className="actions-row" style={{ flexWrap: 'wrap', gap: 8 }}>
                      {!isPaid && (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ background: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                          onClick={() => openProofModal(sale)}
                        >
                          <Check size={14} /> Pagamento Realizado (Dar Baixa)
                        </button>
                      )}

                      {!isPaid && (
                        <button
                          className={`btn btn-sm ${isLockedForEdit ? 'btn-ghost' : 'btn-ghost'}`}
                          style={{ opacity: isLockedForEdit ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => openEdit(sale)}
                          title={isLockedForEdit ? 'Bloqueado: Produção em andamento ou concluída' : 'Editar itens e quantidades'}
                        >
                          {isLockedForEdit ? <Lock size={14} color="var(--accent-rose)" /> : <Edit size={14} />}
                          Editar
                        </button>
                      )}

                      {isPaid && sale.proofFileUrl && (
                        <a
                          href={sale.proofFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-ghost btn-sm"
                          style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-indigo)' }}
                        >
                          <FileText size={14} /> Ver Comprovante
                        </a>
                      )}

                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(sale)} title="Excluir"><X size={14} /></button>
                    </div>
                  </div>
                </div>

                {/* Lista de Itens da Venda */}
                <div style={{ marginTop: 16, borderTop: '1px solid var(--border-primary)', paddingTop: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                    {sale.items?.map((item) => (
                      <div key={item.id} style={{ background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, fontSize: '0.85rem', border: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{item.product?.name || 'Peça 3D'}</div>
                          <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{item.quantity} unid. × {formatCurrency(item.unitPrice)}</div>
                        </div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(item.totalPrice)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Exibição clara do Gatilho e das OPs Vinculadas */}
                {sale.productionOrders && sale.productionOrders.length > 0 && (
                  <div style={{ marginTop: 12, background: 'rgba(99, 102, 241, 0.08)', border: '1px dashed var(--accent-indigo)', padding: 10, borderRadius: 8, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-indigo)' }}>
                      <Printer size={15} />
                      <span><strong>{sale.productionOrders.length} Ordem(ns) de Produção</strong> atreladas a este pedido no painel de Produção.</span>
                    </div>
                    {isLockedForEdit && (
                      <span style={{ color: 'var(--accent-rose)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Lock size={12} /> Quantidade travada pelo status de fabricação
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CRIAR / EDITAR VENDA DIRETA */}
      {(showCreateModal || showEditModal) && (
        <div className="modal-overlay" onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}>
          <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{showEditModal ? `Editar Venda #V-${selectedSale?.id}` : 'Nova Venda Direta / Sob Demanda'}</h2>
              <button className="modal-close" onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Cliente (Ou Ponto de Venda/Parceiro)</label>
                    <select
                      className="form-select"
                      value={form.salesPointId}
                      onChange={e => {
                        const val = e.target.value;
                        const pt = salesPoints.find(p => p.id === Number(val));
                        setForm({
                          ...form,
                          salesPointId: val,
                          customerName: pt ? pt.name : form.customerName,
                          customerContact: pt ? pt.contactPhone || '' : form.customerContact,
                        });
                      }}
                    >
                      <option value="">-- Cliente Avulso / Encomenda --</option>
                      {salesPoints.map(sp => <option key={sp.id} value={sp.id}>📍 {sp.name} (Parceiro)</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nome Completo do Cliente *</label>
                    <input className="form-input" placeholder="ex: Vizinha Maria, Loja Central..." value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} required />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">WhatsApp / Telefone de Contato</label>
                  <input className="form-input" placeholder="(11) 99999-9999" value={form.customerContact} onChange={e => setForm({ ...form, customerContact: e.target.value })} />
                </div>

                {/* ITENS E CALCULADORA OCULTA */}
                <div style={{ margin: '16px 0', borderTop: '1px solid var(--border-primary)', paddingTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <label className="form-label" style={{ marginBottom: 2 }}>Peças & Quantidades (Calculadora Oculta)</label>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Os tempos de impressão são calculados automaticamente e as OPs enviadas à fila.</div>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={addItemRow}><Plus size={14} /> Adicionar Item</button>
                  </div>

                  {formItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <select className="form-select" value={item.productId} onChange={e => handleItemChange(idx, 'productId', e.target.value)} required>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} (~{p.estimatedPrintMinutes || 60} min | Preço: {formatCurrency(p.salePrice)})</option>)}
                        </select>
                      </div>
                      <div>
                        <input className="form-input" type="number" min="1" placeholder="Qtd" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', e.target.value)} required />
                      </div>
                      <div>
                        <input className="form-input" type="number" step="0.01" placeholder="Preço Unit. (R$)" value={item.unitPrice} onChange={e => handleItemChange(idx, 'unitPrice', e.target.value)} required />
                      </div>
                      {formItems.length > 1 && (
                        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => removeItemRow(idx)}><X size={14} /></button>
                      )}
                    </div>
                  ))}

                  {/* Resumo Oculto / Display ao Cliente */}
                  <div style={{ background: 'var(--bg-secondary)', padding: 14, borderRadius: 8, marginTop: 16, border: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tempo de Produção Estimado:</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--accent-indigo)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Clock size={16} /> ~{Math.floor(hiddenTotals.mins / 60)}h e {hiddenTotals.mins % 60}min total
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total da Venda (Cliente):</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                        {formatCurrency(hiddenTotals.total)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Observações Específicas da Venda</label>
                  <textarea className="form-textarea" placeholder="Cor desejada, prazo combinado, detalhes do pedido..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  {showEditModal ? 'Salvar Alterações e Sincronizar OP' : 'Confirmar Venda & Gerar OP na Fila 🖨️'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BAIXA COM COMPROVANTE OBRIGATÓRIO */}
      {showProofModal && selectedSale && (
        <div className="modal-overlay" onClick={() => setShowProofModal(false)}>
          <div className="modal" style={{ maxWidth: 550 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Confirmar Pagamento & Baixa #V-{selectedSale.id}</h2>
              <button className="modal-close" onClick={() => setShowProofModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleProofSubmit}>
              <div className="modal-body">
                <div className="alert alert-warning" style={{ marginBottom: 16, fontSize: '0.85rem', display: 'flex', gap: 10 }}>
                  <AlertCircle size={20} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Regra de Comprovação Obrigatória:</strong><br />
                    Para transferir esta venda para o histórico de quitadas, você precisa anexar o comprovante (print do PIX, nota fiscal ou foto).
                  </div>
                </div>

                <div style={{ margin: '16px 0', textAlign: 'center', border: '2px dashed var(--border-primary)', padding: 24, borderRadius: 8, background: 'var(--bg-secondary)' }}>
                  <Upload size={32} color="var(--accent-indigo)" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    {proofFileName || 'Clique ou arraste o arquivo do comprovante aqui'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                    Formatos suportados: PNG, JPG ou PDF (Máx 5MB)
                  </div>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                    className="form-input"
                    style={{ maxWidth: 260, margin: '0 auto' }}
                    required={!proofFileBase64}
                  />
                  {proofFileBase64 && (
                    <div style={{ marginTop: 12, color: 'var(--accent-emerald)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <CheckCircle2 size={16} /> Arquivo carregado e pronto para anexo!
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Observações da Baixa (Opcional)</label>
                  <textarea className="form-textarea" placeholder="ex: Pago via PIX pelo celular final 4321..." value={proofNotes} onChange={e => setProofNotes(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowProofModal(false)}>Cancelar</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)' }}
                  disabled={!proofFileBase64}
                >
                  Confirmar Baixa de Pagamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VendasPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>}>
      <VendasContent />
    </Suspense>
  );
}
