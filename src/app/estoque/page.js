'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Edit, Boxes, AlertTriangle, X, Package, CheckCircle2,
  ToggleLeft, ToggleRight, DollarSign, Wrench, RefreshCw, Tag
} from 'lucide-react';
import { formatCurrency, formatWeight } from '@/lib/formatters';

const MATERIALS = ['PLA', 'ABS', 'PETG', 'TPU', 'Nylon', 'Resina', 'ASA', 'PC'];

export default function EstoquePage() {
  const [activeTab, setActiveTab] = useState('filaments'); // 'filaments' or 'supplies'
  const [rolls, setRolls] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showRollModal, setShowRollModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showSupplyModal, setShowSupplyModal] = useState(false);

  // States for editing
  const [editingRoll, setEditingRoll] = useState(null);
  const [priceRoll, setPriceRoll] = useState(null);
  const [editingSupply, setEditingSupply] = useState(null);

  // Forms
  const [rollForm, setRollForm] = useState({ material: 'PLA', color: '', brand: '', initialWeightG: '1000', costPerRoll: '' });
  const [priceForm, setPriceForm] = useState({ costPerRoll: '', initialWeightG: '1000' });
  const [supplyForm, setSupplyForm] = useState({ name: '', category: 'Hardware', unitCost: '', stockQuantity: '0' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rollsRes, suppliesRes] = await Promise.all([
        fetch('/api/filament-rolls'),
        fetch('/api/supplies'),
      ]);
      const rollsData = await rollsRes.json();
      const suppliesData = await suppliesRes.json();
      setRolls(Array.isArray(rollsData) ? rollsData : []);
      setSupplies(Array.isArray(suppliesData) ? suppliesData : []);
    } catch {
      setRolls([]);
      setSupplies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ==========================================
  // FILAMENT ROLLS HANDLERS
  // ==========================================
  const openCreateRoll = () => {
    setEditingRoll(null);
    setRollForm({ material: 'PLA', color: '', brand: '', initialWeightG: '1000', costPerRoll: '' });
    setShowRollModal(true);
  };

  const openEditRoll = (roll) => {
    setEditingRoll(roll);
    setRollForm({
      material: roll.material,
      color: roll.color,
      brand: roll.brand,
      initialWeightG: roll.initialWeightG,
      costPerRoll: roll.costPerRoll,
    });
    setShowRollModal(true);
  };

  const openQuickPriceUpdate = (roll) => {
    setPriceRoll(roll);
    setPriceForm({
      costPerRoll: roll.costPerRoll || '',
      initialWeightG: roll.initialWeightG || '1000',
    });
    setShowPriceModal(true);
  };

  const handleRollSubmit = async (e) => {
    e.preventDefault();
    const method = editingRoll ? 'PUT' : 'POST';
    const body = editingRoll ? { id: editingRoll.id, ...rollForm } : rollForm;
    await fetch('/api/filament-rolls', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setShowRollModal(false);
    fetchData();
  };

  const handleQuickPriceSubmit = async (e) => {
    e.preventDefault();
    await fetch('/api/filament-rolls', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: priceRoll.id,
        costPerRoll: Number(priceForm.costPerRoll),
        initialWeightG: Number(priceForm.initialWeightG),
        isPriceUpdate: true, // Força reativar o status Ativo
      }),
    });
    setShowPriceModal(false);
    fetchData();
  };

  const handleToggleActiveRoll = async (roll) => {
    await fetch('/api/filament-rolls', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: roll.id, active: !roll.active }),
    });
    fetchData();
  };

  const handleDeleteRoll = async (id) => {
    if (!confirm('Remover este filamento do cadastro de ativos?')) return;
    await fetch(`/api/filament-rolls?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  // ==========================================
  // SUPPLIES / HARDWARE HANDLERS
  // ==========================================
  const openCreateSupply = () => {
    setEditingSupply(null);
    setSupplyForm({ name: '', category: 'Hardware', unitCost: '', stockQuantity: '0' });
    setShowSupplyModal(true);
  };

  const openEditSupply = (supply) => {
    setEditingSupply(supply);
    setSupplyForm({
      name: supply.name,
      category: supply.category || 'Hardware',
      unitCost: supply.unitCost,
      stockQuantity: supply.stockQuantity || 0,
    });
    setShowSupplyModal(true);
  };

  const handleSupplySubmit = async (e) => {
    e.preventDefault();
    const method = editingSupply ? 'PUT' : 'POST';
    const body = editingSupply ? { id: editingSupply.id, ...supplyForm } : supplyForm;
    await fetch('/api/supplies', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setShowSupplyModal(false);
    fetchData();
  };

  const handleToggleActiveSupply = async (supply) => {
    await fetch('/api/supplies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: supply.id, active: !supply.active }),
    });
    fetchData();
  };

  const handleDeleteSupply = async (id) => {
    if (!confirm('Remover este insumo do catálogo?')) return;
    await fetch(`/api/supplies?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  const activeRollsCount = rolls.filter(r => r.active).length;
  const activeSuppliesCount = supplies.filter(s => s.active).length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestão de Estoque & Insumos</h1>
          <p className="page-subtitle">Catálogo qualitativo de filamentos ativos e insumos de montagem (Sem baixa quantitativa de gramas)</p>
        </div>
        <div>
          {activeTab === 'filaments' ? (
            <button className="btn btn-primary" onClick={openCreateRoll}><Plus size={16} /> Novo Filamento</button>
          ) : (
            <button className="btn btn-primary" onClick={openCreateSupply}><Plus size={16} /> Novo Insumo / Hardware</button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card indigo">
          <div className="stat-card-header"><div className="stat-card-icon indigo"><Boxes size={20} /></div></div>
          <div className="stat-card-label">Filamentos Ativos (Prontos)</div>
          <div className="stat-card-value">{activeRollsCount} <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>/ {rolls.length} total</span></div>
        </div>
        <div className="stat-card emerald">
          <div className="stat-card-header"><div className="stat-card-icon emerald"><Wrench size={20} /></div></div>
          <div className="stat-card-label">Insumos Extras & Hardware Ativos</div>
          <div className="stat-card-value">{activeSuppliesCount} <span style={{ fontSize: 13, color: '#64748b', fontWeight: 400 }}>/ {supplies.length} total</span></div>
        </div>
        <div className="stat-card cyan">
          <div className="stat-card-header"><div className="stat-card-icon cyan"><CheckCircle2 size={20} /></div></div>
          <div className="stat-card-label">Modelo de Controle</div>
          <div className="stat-card-value" style={{ fontSize: 18, marginTop: 4 }}>Qualitativo (Preço Base/g)</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-header" style={{ marginBottom: 20 }}>
        <button
          className={`tab-btn ${activeTab === 'filaments' ? 'active' : ''}`}
          onClick={() => setActiveTab('filaments')}
        >
          <Boxes size={16} style={{ marginRight: 8 }} />
          🧵 Catálogo de Filamentos Ativos ({rolls.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'supplies' ? 'active' : ''}`}
          onClick={() => setActiveTab('supplies')}
        >
          <Wrench size={16} style={{ marginRight: 8 }} />
          🔧 Insumos Extras & Hardware ({supplies.length})
        </button>
      </div>

      {/* TAB 1: FILAMENTOS ATIVOS */}
      {activeTab === 'filaments' && (
        <div className="table-container">
          <div style={{ padding: '12px 16px', background: 'rgba(99, 102, 241, 0.05)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#818cf8' }}>
              💡 <strong>Regra do Estoque Qualitativo:</strong> O filamento não sofre subtração automática em gramas nas impressões. Se um rolo acabou ou saiu de linha, clique no botão <strong>Ativo/Inativo</strong> para desativá-lo. Quando comprar mais do mesmo material, clique em <strong>[ 🏷️ Nova Compra ]</strong> para atualizar o preço base sem recadastrar tudo.
            </span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Cor</th>
                <th>Marca</th>
                <th>Peso Base (Rolo)</th>
                <th>Custo Pago / Rolo</th>
                <th>Custo Base / Grama (R$)</th>
                <th style={{ textAlign: 'center' }}>Status (Ativo/Inativo)</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }}></div></td></tr>
              ) : rolls.length === 0 ? (
                <tr><td colSpan="8">
                  <div className="empty-state">
                    <Boxes />
                    <div className="empty-state-title">Nenhum filamento cadastrado</div>
                    <div className="empty-state-text">Clique em &quot;Novo Filamento&quot; para adicionar suas cores e preços base</div>
                  </div>
                </td></tr>
              ) : rolls.map(roll => {
                const isActive = roll.active !== false;
                return (
                  <tr key={roll.id} style={{ opacity: isActive ? 1 : 0.55, transition: 'all 0.2s' }}>
                    <td><strong>{roll.material}</strong></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="color-swatch" style={{ background: roll.color.toLowerCase(), width: 14, height: 14, borderRadius: '50%', border: '1px solid #fff' }}></span>
                        <span>{roll.color}</span>
                      </div>
                    </td>
                    <td>{roll.brand}</td>
                    <td>{formatWeight(roll.initialWeightG)}</td>
                    <td>{formatCurrency(roll.costPerRoll)}</td>
                    <td>
                      <span className="badge badge-indigo" style={{ fontSize: 13, fontWeight: 600 }}>
                        R$ {Number(roll.costPerGram).toFixed(4)} / g
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleActiveRoll(roll)}
                        style={{
                          background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                          color: isActive ? '#10b981' : '#f43f5e',
                          border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                          padding: '5px 12px',
                          borderRadius: 20,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          transition: 'all 0.2s'
                        }}
                      >
                        {isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        {isActive ? 'Ativo (Disponível)' : 'Inativo (Esgotado)'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="actions-row" style={{ justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openQuickPriceUpdate(roll)}
                          style={{ color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '4px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                          title="Adicionar Nova Compra / Atualizar Preço sem recadastrar"
                        >
                          <Tag size={13} /> Nova Compra / Preço
                        </button>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEditRoll(roll)} title="Editar"><Edit size={14} /></button>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDeleteRoll(roll.id)} title="Remover"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: INSUMOS & HARDWARE */}
      {activeTab === 'supplies' && (
        <div className="table-container">
          <div style={{ padding: '12px 16px', background: 'rgba(16, 185, 129, 0.05)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#34d399' }}>
              🔧 <strong>Controle de Hardware da Planilha V2:</strong> Cadastre o preço unitário dos seus itens de montagem (Argola Chaveiro R$ 0,35, Fecho Lagosta, Ímãs de Neodímio, Embalagens). Eles serão puxados automaticamente na nova Calculadora de Peças.
            </span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome do Insumo / Componente</th>
                <th>Categoria</th>
                <th>Custo Unitário (R$)</th>
                <th>Estoque Cadastrado</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }}></div></td></tr>
              ) : supplies.length === 0 ? (
                <tr><td colSpan="6">
                  <div className="empty-state">
                    <Wrench />
                    <div className="empty-state-title">Nenhum insumo extra cadastrado</div>
                    <div className="empty-state-text">Ex: Argola Chaveiro, Parafuso M3, Embalagem Plástica</div>
                  </div>
                </td></tr>
              ) : supplies.map(supply => {
                const isActive = supply.active !== false;
                return (
                  <tr key={supply.id} style={{ opacity: isActive ? 1 : 0.55 }}>
                    <td><strong>{supply.name}</strong></td>
                    <td><span className="badge badge-cyan">{supply.category || 'Hardware'}</span></td>
                    <td>
                      <span className="badge badge-emerald" style={{ fontSize: 13, fontWeight: 600 }}>
                        {formatCurrency(supply.unitCost)} / un
                      </span>
                    </td>
                    <td>{supply.stockQuantity} unidades</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleActiveSupply(supply)}
                        style={{
                          background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                          color: isActive ? '#10b981' : '#f43f5e',
                          border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                          padding: '4px 10px',
                          borderRadius: 20,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 12,
                          fontWeight: 600
                        }}
                      >
                        {isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        {isActive ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="actions-row" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEditSupply(supply)} title="Editar"><Edit size={14} /></button>
                        <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDeleteSupply(supply.id)} title="Remover"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: NOVO/EDITAR FILAMENTO */}
      {showRollModal && (
        <div className="modal-overlay" onClick={() => setShowRollModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingRoll ? 'Editar Filamento' : 'Novo Filamento Ativo'}</h2>
              <button className="modal-close" onClick={() => setShowRollModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleRollSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Material</label>
                    <select className="form-select" value={rollForm.material} onChange={e => setRollForm({ ...rollForm, material: e.target.value })}>
                      {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cor</label>
                    <input className="form-input" placeholder="Ex: Preto, Vermelho, Cinza" value={rollForm.color} onChange={e => setRollForm({ ...rollForm, color: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Marca / Fabricante</label>
                  <input className="form-input" placeholder="Ex: Voolt3D, eSUN, Creality" value={rollForm.brand} onChange={e => setRollForm({ ...rollForm, brand: e.target.value })} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Peso Base do Rolo (g)</label>
                    <input className="form-input" type="number" step="0.01" placeholder="1000" value={rollForm.initialWeightG} onChange={e => setRollForm({ ...rollForm, initialWeightG: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Custo Pago / Rolo (R$)</label>
                    <input className="form-input" type="number" step="0.01" placeholder="120.00" value={rollForm.costPerRoll} onChange={e => setRollForm({ ...rollForm, costPerRoll: e.target.value })} required />
                  </div>
                </div>
                {rollForm.initialWeightG && rollForm.costPerRoll && (
                  <div className="alert alert-info">
                    <Package size={16} />
                    <span>Custo Base calculado: <strong>R$ {(Number(rollForm.costPerRoll) / Number(rollForm.initialWeightG)).toFixed(4)} per grama</strong></span>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowRollModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editingRoll ? 'Salvar Alterações' : 'Cadastrar Ativo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ATUALIZAR PREÇO / NOVA COMPRA RÁPIDA */}
      {showPriceModal && priceRoll && (
        <div className="modal-overlay" onClick={() => setShowPriceModal(false)}>
          <div className="modal" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">🏷️ Nova Compra / Atualizar Preço</h2>
              <button className="modal-close" onClick={() => setShowPriceModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleQuickPriceSubmit}>
              <div className="modal-body">
                <div className="alert alert-info" style={{ background: 'rgba(56, 189, 248, 0.1)', borderColor: 'rgba(56, 189, 248, 0.3)', color: '#38bdf8', marginBottom: 16 }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>{priceRoll.material} {priceRoll.color} ({priceRoll.brand})</strong>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Preço atual: R$ {Number(priceRoll.costPerRoll).toFixed(2)} / rolo (R$ {Number(priceRoll.costPerGram).toFixed(4)}/g)</div>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
                  Insira o valor pago na sua compra mais recente deste mesmo filamento. O sistema atualizará o custo base e garantirá o status <strong>Ativo</strong>.
                </p>
                <div className="form-group">
                  <label className="form-label">Novo Valor Pago pelo Rolo (R$)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    placeholder="Ex: 130.00"
                    value={priceForm.costPerRoll}
                    onChange={e => setPriceForm({ ...priceForm, costPerRoll: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Peso do Rolo (g)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    value={priceForm.initialWeightG}
                    onChange={e => setPriceForm({ ...priceForm, initialWeightG: e.target.value })}
                    required
                  />
                </div>
                {priceForm.costPerRoll && priceForm.initialWeightG && (
                  <div style={{ padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 8, color: '#10b981', fontSize: 13 }}>
                    Novo Custo Base: <strong>R$ {(Number(priceForm.costPerRoll) / Number(priceForm.initialWeightG)).toFixed(4)} / grama</strong>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowPriceModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#38bdf8', color: '#0f172a', fontWeight: 600 }}>Confirmar Nova Compra</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: INSUMO / HARDWARE */}
      {showSupplyModal && (
        <div className="modal-overlay" onClick={() => setShowSupplyModal(false)}>
          <div className="modal" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingSupply ? 'Editar Insumo Extra' : 'Novo Insumo / Componente'}</h2>
              <button className="modal-close" onClick={() => setShowSupplyModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSupplySubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nome do Componente</label>
                  <input className="form-input" placeholder="Ex: Argola Chaveiro, Parafuso M3x10, Fecho Lagosta" value={supplyForm.name} onChange={e => setSupplyForm({ ...supplyForm, name: e.target.value })} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Categoria</label>
                    <select className="form-select" value={supplyForm.category} onChange={e => setSupplyForm({ ...supplyForm, category: e.target.value })}>
                      <option value="Hardware">Hardware / Metal</option>
                      <option value="Embalagem">Embalagem</option>
                      <option value="Acessório">Acessório</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Custo Unitário (R$)</label>
                    <input className="form-input" type="number" step="0.0001" placeholder="0.35" value={supplyForm.unitCost} onChange={e => setSupplyForm({ ...supplyForm, unitCost: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Estoque Cadastrado (Opcional)</label>
                  <input className="form-input" type="number" value={supplyForm.stockQuantity} onChange={e => setSupplyForm({ ...supplyForm, stockQuantity: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowSupplyModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editingSupply ? 'Salvar' : 'Cadastrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
