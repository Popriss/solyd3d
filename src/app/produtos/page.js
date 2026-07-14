'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Package, ExternalLink, Trash2, Edit, X } from 'lucide-react';
import { formatCurrency, formatWeight, formatDuration, formatPercent } from '@/lib/formatters';

const MATERIALS = ['PLA', 'ABS', 'PETG', 'TPU', 'Nylon', 'Resina', 'ASA', 'PC'];

export default function ProdutosPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', description: '', projectLink: '', estimatedWeightG: '',
    estimatedPrintMinutes: '', recommendedMaterial: 'PLA', recommendedColor: '', profitMarginPct: '50',
  });

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch { setProducts([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', projectLink: '', estimatedWeightG: '', estimatedPrintMinutes: '', recommendedMaterial: 'PLA', recommendedColor: '', profitMarginPct: '50' }); setShowModal(true); };
  const openEdit = (p) => { setEditing(p); setForm({ name: p.name, description: p.description || '', projectLink: p.projectLink || '', estimatedWeightG: p.estimatedWeightG, estimatedPrintMinutes: p.estimatedPrintMinutes, recommendedMaterial: p.recommendedMaterial || 'PLA', recommendedColor: p.recommendedColor || '', profitMarginPct: p.profitMarginPct }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const method = editing ? 'PUT' : 'POST';
    const body = editing ? { id: editing.id, ...form } : form;
    await fetch('/api/products', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setShowModal(false);
    fetchProducts();
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover este produto?')) return;
    await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
    fetchProducts();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Catálogo de Produtos</h1>
          <p className="page-subtitle">Peças cadastradas com custeio dinâmico</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Novo Produto</button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Nome</th><th>Material</th><th>Peso Est.</th><th>Tempo Est.</th><th>Margem</th><th>Link</th><th>Ações</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }}></div></td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan="7"><div className="empty-state"><Package /><div className="empty-state-title">Nenhum produto cadastrado</div></div></td></tr>
            ) : products.map(p => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong></td>
                <td><span className="badge badge-indigo">{p.recommendedMaterial || '-'}</span></td>
                <td>{formatWeight(p.estimatedWeightG)}</td>
                <td>{formatDuration(p.estimatedPrintMinutes)}</td>
                <td>{formatPercent(p.profitMarginPct)}</td>
                <td>{p.projectLink ? <a href={p.projectLink} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /></a> : '-'}</td>
                <td><div className="actions-row"><button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(p)}><Edit size={14} /></button><button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(p.id)}><Trash2 size={14} /></button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 className="modal-title">{editing ? 'Editar Produto' : 'Novo Produto'}</h2><button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Nome da Peça</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                <div className="form-group"><label className="form-label">Descrição</label><textarea className="form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Link do Projeto</label><input className="form-input" placeholder="https://thingiverse.com/..." value={form.projectLink} onChange={e => setForm({ ...form, projectLink: e.target.value })} /></div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Peso Estimado (g)</label><input className="form-input" type="number" step="0.01" value={form.estimatedWeightG} onChange={e => setForm({ ...form, estimatedWeightG: e.target.value })} required /></div>
                  <div className="form-group"><label className="form-label">Tempo Est. (min)</label><input className="form-input" type="number" value={form.estimatedPrintMinutes} onChange={e => setForm({ ...form, estimatedPrintMinutes: e.target.value })} required /></div>
                </div>
                <div className="form-row-3">
                  <div className="form-group"><label className="form-label">Material</label><select className="form-select" value={form.recommendedMaterial} onChange={e => setForm({ ...form, recommendedMaterial: e.target.value })}>{MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Cor</label><input className="form-input" value={form.recommendedColor} onChange={e => setForm({ ...form, recommendedColor: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Margem (%)</label><input className="form-input" type="number" step="0.1" value={form.profitMarginPct} onChange={e => setForm({ ...form, profitMarginPct: e.target.value })} /></div>
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button><button type="submit" className="btn btn-primary">{editing ? 'Salvar' : 'Cadastrar'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
