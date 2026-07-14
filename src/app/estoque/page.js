'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Edit, Boxes, AlertTriangle, X, Package
} from 'lucide-react';
import { formatCurrency, formatWeight, formatDate, filamentStatusLabels } from '@/lib/formatters';

const statusBadgeMap = {
  AVAILABLE: 'badge-emerald',
  LOW: 'badge-amber',
  EMPTY: 'badge-rose',
  RESERVED: 'badge-violet',
};

const MATERIALS = ['PLA', 'ABS', 'PETG', 'TPU', 'Nylon', 'Resina', 'ASA', 'PC'];

export default function EstoquePage() {
  const [rolls, setRolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ material: 'PLA', color: '', brand: '', initialWeightG: '', costPerRoll: '' });

  const fetchRolls = useCallback(async () => {
    try {
      const res = await fetch('/api/filament-rolls');
      const data = await res.json();
      setRolls(Array.isArray(data) ? data : []);
    } catch { setRolls([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRolls(); }, [fetchRolls]);

  const openCreate = () => {
    setEditing(null);
    setForm({ material: 'PLA', color: '', brand: '', initialWeightG: '', costPerRoll: '' });
    setShowModal(true);
  };

  const openEdit = (roll) => {
    setEditing(roll);
    setForm({
      material: roll.material,
      color: roll.color,
      brand: roll.brand,
      initialWeightG: roll.initialWeightG,
      costPerRoll: roll.costPerRoll,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const method = editing ? 'PUT' : 'POST';
    const body = editing ? { id: editing.id, ...form } : form;
    await fetch('/api/filament-rolls', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setShowModal(false);
    fetchRolls();
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover este rolo do estoque?')) return;
    await fetch(`/api/filament-rolls?id=${id}`, { method: 'DELETE' });
    fetchRolls();
  };

  const lowStockCount = rolls.filter(r => r.status === 'LOW' || r.status === 'EMPTY').length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Controle de Estoque</h1>
          <p className="page-subtitle">Gerencie seus rolos de filamento e insumos</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Novo Rolo</button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card indigo">
          <div className="stat-card-header">
            <div className="stat-card-icon indigo"><Boxes size={20} /></div>
          </div>
          <div className="stat-card-label">Total de Rolos</div>
          <div className="stat-card-value">{rolls.length}</div>
        </div>
        <div className="stat-card emerald">
          <div className="stat-card-header">
            <div className="stat-card-icon emerald"><Package size={20} /></div>
          </div>
          <div className="stat-card-label">Disponíveis</div>
          <div className="stat-card-value">{rolls.filter(r => r.status === 'AVAILABLE').length}</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-card-header">
            <div className="stat-card-icon amber"><AlertTriangle size={20} /></div>
          </div>
          <div className="stat-card-label">Estoque Baixo</div>
          <div className="stat-card-value">{lowStockCount}</div>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Cor</th>
              <th>Marca</th>
              <th>Peso Inicial</th>
              <th>Restante</th>
              <th>Custo/Rolo</th>
              <th>Custo/g</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }}></div></td></tr>
            ) : rolls.length === 0 ? (
              <tr><td colSpan="9">
                <div className="empty-state">
                  <Boxes />
                  <div className="empty-state-title">Nenhum rolo cadastrado</div>
                  <div className="empty-state-text">Clique em &quot;Novo Rolo&quot; para adicionar seu primeiro filamento</div>
                </div>
              </td></tr>
            ) : rolls.map(roll => {
              const pct = Number(roll.initialWeightG) > 0
                ? (Number(roll.remainingWeightG) / Number(roll.initialWeightG)) * 100
                : 0;
              const barColor = pct > 50 ? 'emerald' : pct > 20 ? 'amber' : 'rose';
              return (
                <tr key={roll.id}>
                  <td><strong>{roll.material}</strong></td>
                  <td>
                    <span className="color-swatch" style={{ background: roll.color.toLowerCase() }}></span>
                    {roll.color}
                  </td>
                  <td>{roll.brand}</td>
                  <td>{formatWeight(roll.initialWeightG)}</td>
                  <td>
                    <div>{formatWeight(roll.remainingWeightG)}</div>
                    <div className="progress-bar" style={{ width: 80, marginTop: 4 }}>
                      <div className={`progress-fill ${barColor}`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </td>
                  <td>{formatCurrency(roll.costPerRoll)}</td>
                  <td>{formatCurrency(roll.costPerGram)}</td>
                  <td><span className={`badge ${statusBadgeMap[roll.status]}`}><span className="badge-dot"></span>{filamentStatusLabels[roll.status]}</span></td>
                  <td>
                    <div className="actions-row">
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(roll)} title="Editar"><Edit size={14} /></button>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(roll.id)} title="Remover"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar Rolo' : 'Novo Rolo de Filamento'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Material</label>
                    <select className="form-select" value={form.material} onChange={e => setForm({ ...form, material: e.target.value })}>
                      {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cor</label>
                    <input className="form-input" placeholder="Ex: Branco, Preto, Vermelho" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Marca</label>
                  <input className="form-input" placeholder="Ex: 3D Fila, eSUN, Creality" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Peso Inicial (g)</label>
                    <input className="form-input" type="number" step="0.01" placeholder="1000" value={form.initialWeightG} onChange={e => setForm({ ...form, initialWeightG: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Custo do Rolo (R$)</label>
                    <input className="form-input" type="number" step="0.01" placeholder="89.90" value={form.costPerRoll} onChange={e => setForm({ ...form, costPerRoll: e.target.value })} required />
                  </div>
                </div>
                {form.initialWeightG && form.costPerRoll && (
                  <div className="alert alert-info">
                    <Package size={16} />
                    <span>Custo por grama: <strong>{formatCurrency(Number(form.costPerRoll) / Number(form.initialWeightG))}</strong></span>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Salvar' : 'Cadastrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
