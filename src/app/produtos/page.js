'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Package, ExternalLink, Trash2, Edit, X, Palette, Wrench, Layers } from 'lucide-react';
import { formatCurrency, formatWeight, formatDuration, formatPercent } from '@/lib/formatters';

const MATERIALS = ['PLA', 'ABS', 'PETG', 'TPU', 'Nylon', 'Resina', 'ASA', 'PC'];

export default function ProdutosPage() {
  const [products, setProducts] = useState([]);
  const [rolls, setRolls] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    name: '', description: '', projectLink: '', estimatedWeightG: '',
    estimatedPrintMinutes: '', recommendedMaterial: 'PLA', recommendedColor: '', profitMarginPct: '50',
    salePrice: '', powerWatts: '',
    color1: '', weight1G: '', time1Min: '',
    color2: '', weight2G: '', time2Min: '',
    color3: '', weight3G: '', time3Min: '',
    extra1Name: '', extra1Qty: '',
    extra2Name: '', extra2Qty: '',
    plates: [], // Array de chapas [{ name, estimatedWeightG, estimatedPrintMinutes, materialColorNeeded, yieldPerCycle }]
  });

  const fetchProducts = useCallback(async () => {
    try {
      const [res, rRes, sRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/filament-rolls'),
        fetch('/api/supplies'),
      ]);
      const data = await res.json();
      const rData = await rRes.json();
      const sData = await sRes.json();
      setProducts(Array.isArray(data) ? data : []);
      setRolls(Array.isArray(rData) ? rData : []);
      setSupplies(Array.isArray(sData) ? sData : []);
    } catch { setProducts([]); setRolls([]); setSupplies([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '', description: '', projectLink: '', estimatedWeightG: '',
      estimatedPrintMinutes: '', recommendedMaterial: 'PLA', recommendedColor: '', profitMarginPct: '50',
      salePrice: '', powerWatts: '',
      color1: '', weight1G: '', time1Min: '',
      color2: '', weight2G: '', time2Min: '',
      color3: '', weight3G: '', time3Min: '',
      extra1Name: '', extra1Qty: '',
      extra2Name: '', extra2Qty: '',
      plates: [],
    });
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || '',
      projectLink: p.projectLink || '',
      estimatedWeightG: p.estimatedWeightG || '',
      estimatedPrintMinutes: p.estimatedPrintMinutes || '',
      recommendedMaterial: p.recommendedMaterial || 'PLA',
      recommendedColor: p.recommendedColor || '',
      profitMarginPct: p.profitMarginPct || '50',
      salePrice: p.salePrice || '',
      powerWatts: p.powerWatts || '',
      color1: p.color1 || '', weight1G: p.weight1G || '', time1Min: p.time1Min || '',
      color2: p.color2 || '', weight2G: p.weight2G || '', time2Min: p.time2Min || '',
      color3: p.color3 || '', weight3G: p.weight3G || '', time3Min: p.time3Min || '',
      extra1Name: p.extra1Name || '', extra1Qty: p.extra1Qty || '',
      extra2Name: p.extra2Name || '', extra2Qty: p.extra2Qty || '',
      plates: Array.isArray(p.plates) ? p.plates.map(pl => ({
        name: pl.name || '',
        estimatedWeightG: pl.estimatedWeightG || '',
        estimatedPrintMinutes: pl.estimatedPrintMinutes || '',
        materialColorNeeded: pl.materialColorNeeded || '',
        yieldPerCycle: pl.yieldPerCycle || 1,
      })) : [],
    });
    setShowModal(true);
  };

  // Funções de manipulação do BOM Multi-Chapas
  const addPlate = () => {
    const nextPlates = [
      ...form.plates,
      { name: `Chapa ${form.plates.length + 1}`, estimatedWeightG: '50', estimatedPrintMinutes: '60', materialColorNeeded: 'PLA', yieldPerCycle: 1 },
    ];
    updatePlatesAndTotals(nextPlates);
  };

  const removePlate = (index) => {
    const nextPlates = form.plates.filter((_, i) => i !== index);
    updatePlatesAndTotals(nextPlates);
  };

  const updatePlateField = (index, field, value) => {
    const nextPlates = form.plates.map((pl, i) => i === index ? { ...pl, [field]: value } : pl);
    updatePlatesAndTotals(nextPlates);
  };

  const updatePlatesAndTotals = (nextPlates) => {
    if (nextPlates.length > 0) {
      const totalW = nextPlates.reduce((sum, pl) => sum + (Number(pl.estimatedWeightG) || 0), 0);
      const totalT = nextPlates.reduce((sum, pl) => sum + (Number(pl.estimatedPrintMinutes) || 0), 0);
      setForm({ ...form, plates: nextPlates, estimatedWeightG: totalW, estimatedPrintMinutes: totalT });
    } else {
      setForm({ ...form, plates: nextPlates });
    }
  };

  // Calcular peso e tempo automáticos se o usuário preencher as cores separadas
  const handleColorChange = (newForm) => {
    const w1 = Number(newForm.weight1G) || 0;
    const w2 = Number(newForm.weight2G) || 0;
    const w3 = Number(newForm.weight3G) || 0;
    const totalW = w1 + w2 + w3;

    const t1 = Number(newForm.time1Min) || 0;
    const t2 = Number(newForm.time2Min) || 0;
    const t3 = Number(newForm.time3Min) || 0;
    const totalT = t1 + t2 + t3;

    if (totalW > 0) newForm.estimatedWeightG = totalW;
    if (totalT > 0) newForm.estimatedPrintMinutes = totalT;
    setForm({ ...newForm });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const method = editing ? 'PUT' : 'POST';
    const body = editing ? { id: editing.id, ...form } : form;
    await fetch('/api/products', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setShowModal(false);
    fetchProducts();
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover este produto do catálogo?')) return;
    await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
    fetchProducts();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Catálogo de Modelos (Peças Fatiadas)</h1>
          <p className="page-subtitle">Estrutura V2: Composição até 3 cores, consumo e insumos/hardware</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={16} /> Novo Modelo</button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nome do Modelo</th>
              <th>Chapas (BOM .Gcode)</th>
              <th>Cores / Plástico (g)</th>
              <th>Duração Total</th>
              <th>Hardware / Extras</th>
              <th>Preço de Venda</th>
              <th>Link</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }}></div></td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan="8"><div className="empty-state"><Package /><div className="empty-state-title">Nenhum modelo cadastrado</div></div></td></tr>
            ) : products.map(p => {
              const hasColors = p.color1 || p.color2 || p.color3;
              const hasPlates = p.plates && p.plates.length > 0;
              return (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    {p.recommendedMaterial && <div style={{ fontSize: 12, color: '#818cf8', marginTop: 2 }}>Material sugerido: {p.recommendedMaterial}</div>}
                  </td>
                  <td>
                    {hasPlates ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span className="badge badge-purple" style={{ alignSelf: 'flex-start', fontSize: 11 }}>
                          🗂️ {p.plates.length} {p.plates.length === 1 ? 'Chapa' : 'Chapas'}
                        </span>
                        <div style={{ fontSize: 11, color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {p.plates.map((pl, i) => (
                            <div key={i}>
                              • <strong>{pl.name}</strong> ({formatWeight(pl.estimatedWeightG)}, {formatDuration(pl.estimatedPrintMinutes)}) {pl.yieldPerCycle > 1 ? `[Rende ${pl.yieldPerCycle} un]` : ''}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="badge badge-slate" style={{ fontSize: 11 }}>Chapa Única</span>
                    )}
                  </td>
                  <td>
                    {hasColors ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                        {p.color1 && <div>🎨 Cor 1 ({p.color1}): <strong>{formatWeight(p.weight1G)}</strong></div>}
                        {p.color2 && <div>🎨 Cor 2 ({p.color2}): <strong>{formatWeight(p.weight2G)}</strong></div>}
                        {p.color3 && <div>🎨 Cor 3 ({p.color3}): <strong>{formatWeight(p.weight3G)}</strong></div>}
                        <div style={{ color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 2, marginTop: 2 }}>Total: <strong>{formatWeight(p.estimatedWeightG)}</strong></div>
                      </div>
                    ) : (
                      <span>{formatWeight(p.estimatedWeightG)} {p.recommendedColor ? `(${p.recommendedColor})` : ''}</span>
                    )}
                  </td>
                  <td>{formatDuration(p.estimatedPrintMinutes)}</td>
                  <td>
                    {(p.extra1Name || p.extra2Name) ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                        {p.extra1Name && <div>🔧 {p.extra1Qty || 1}x {p.extra1Name}</div>}
                        {p.extra2Name && <div>🔧 {p.extra2Qty || 1}x {p.extra2Name}</div>}
                      </div>
                    ) : (
                      <span style={{ color: '#64748b' }}>Nenhum</span>
                    )}
                  </td>
                  <td>
                    {p.salePrice ? (
                      <span className="badge badge-emerald" style={{ fontSize: 13, fontWeight: 600 }}>{formatCurrency(p.salePrice)}</span>
                    ) : (
                      <span style={{ color: '#64748b' }}>Dinâmico ({formatPercent(p.profitMarginPct)})</span>
                    )}
                  </td>
                  <td>{p.projectLink ? <a href={p.projectLink} target="_blank" rel="noopener noreferrer" title="Ver no Thingiverse / Printables"><ExternalLink size={14} /></a> : '-'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="actions-row" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(p)} title="Editar"><Edit size={14} /></button>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(p.id)} title="Remover"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editing ? 'Editar Modelo Fatiado' : 'Cadastrar Novo Modelo (V2)'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto', paddingRight: 6 }}>
                <h3 style={{ fontSize: 14, color: '#818cf8', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Package size={16} /> Dados Gerais & Preço
                </h3>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 2 }}>
                    <label className="form-label">Nome da Peça / Modelo</label>
                    <input className="form-input" placeholder="Ex: Chiappa Rhino, Chaveiro Multicolor" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Preço Venda Base (R$)</label>
                    <input className="form-input" type="number" step="0.01" placeholder="Ex: 12.00" value={form.salePrice} onChange={e => setForm({ ...form, salePrice: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Link do Arquivo / Projeto</label>
                    <input className="form-input" placeholder="https://..." value={form.projectLink} onChange={e => setForm({ ...form, projectLink: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Consumo Específico (W) [Opcional]</label>
                    <input className="form-input" type="number" placeholder="Padrão da máquina se vazio" value={form.powerWatts} onChange={e => setForm({ ...form, powerWatts: e.target.value })} />
                  </div>
                </div>

                {/* ========================================================= */}
                {/* BOM MULTI-CHAPAS (ProductPlate) */}
                {/* ========================================================= */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6, margin: '24px 0 14px' }}>
                  <h3 style={{ fontSize: 14, color: '#a855f7', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                    <Layers size={16} /> Chapas de Impressão (.Gcodes) — BOM
                  </h3>
                  <button type="button" className="btn btn-sm" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#d8b4fe', border: '1px solid rgba(168, 85, 247, 0.3)' }} onClick={addPlate}>
                    <Plus size={14} /> Adicionar Chapa
                  </button>
                </div>

                <div style={{ background: 'rgba(168, 85, 247, 0.03)', padding: 12, borderRadius: 8, border: '1px solid rgba(168, 85, 247, 0.15)', marginBottom: 18 }}>
                  {form.plates.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 16, color: '#94a3b8', fontSize: 13 }}>
                      Nenhuma chapa cadastrada. Se deixar vazio, o sistema assumirá <strong>Chapa Única</strong> usando os pesos globais abaixo.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {form.plates.map((pl, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.2fr 1fr auto', gap: 8, alignItems: 'end', background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>Nome da Chapa</label>
                            <input className="form-input" style={{ fontSize: 12, padding: '6px 8px' }} placeholder="Ex: Corpo" value={pl.name} onChange={e => updatePlateField(idx, 'name', e.target.value)} required />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>Peso (g)</label>
                            <input className="form-input" style={{ fontSize: 12, padding: '6px 8px' }} type="number" step="0.01" placeholder="100" value={pl.estimatedWeightG} onChange={e => updatePlateField(idx, 'estimatedWeightG', e.target.value)} required />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>Tempo (min)</label>
                            <input className="form-input" style={{ fontSize: 12, padding: '6px 8px' }} type="number" placeholder="180" value={pl.estimatedPrintMinutes} onChange={e => updatePlateField(idx, 'estimatedPrintMinutes', e.target.value)} required />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>Cor / Material</label>
                            <input className="form-input" style={{ fontSize: 12, padding: '6px 8px' }} placeholder="Ex: PLA Preto" value={pl.materialColorNeeded} onChange={e => updatePlateField(idx, 'materialColorNeeded', e.target.value)} />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }} title="Quantas peças esta chapa rende por rodada">Rendimento / Rodada</label>
                            <input className="form-input" style={{ fontSize: 12, padding: '6px 8px' }} type="number" min="1" placeholder="1" value={pl.yieldPerCycle} onChange={e => updatePlateField(idx, 'yieldPerCycle', e.target.value)} required />
                          </div>
                          <button type="button" className="btn btn-ghost btn-sm btn-icon" style={{ color: '#f87171', marginBottom: 2 }} onClick={() => removePlate(idx)} title="Remover chapa">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <h3 style={{ fontSize: 14, color: '#38bdf8', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6, margin: '20px 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Palette size={16} /> Composição de Cores e Pesos (Até 3 Cores)
                </h3>
                <div style={{ background: 'rgba(56, 189, 248, 0.04)', padding: 12, borderRadius: 8, border: '1px solid rgba(56, 189, 248, 0.15)', marginBottom: 14 }}>
                  <div className="form-row-3" style={{ marginBottom: 10 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 12 }}>🎨 Cor 1 (Filamento)</label>
                      <select className="form-select" value={form.color1} onChange={e => handleColorChange({ ...form, color1: e.target.value })}>
                        <option value="">Selecione filamento (Ativo ou Não)...</option>
                        {rolls.map(r => (
                          <option key={r.id} value={`${r.material} - ${r.color}`}>
                            {r.material} - {r.color} ({r.brand} - {r.active !== false ? '🟢 Ativo' : '⚪ Inativo'})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 12 }}>Peso 1 (g)</label>
                      <input className="form-input" type="number" step="0.01" placeholder="15" value={form.weight1G} onChange={e => handleColorChange({ ...form, weight1G: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 12 }}>Tempo 1 (min)</label>
                      <input className="form-input" type="number" placeholder="120" value={form.time1Min} onChange={e => handleColorChange({ ...form, time1Min: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-row-3" style={{ marginBottom: 10 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 12 }}>🎨 Cor 2 (Opcional)</label>
                      <select className="form-select" value={form.color2} onChange={e => handleColorChange({ ...form, color2: e.target.value })}>
                        <option value="">Nenhuma ou selecione...</option>
                        {rolls.map(r => (
                          <option key={r.id} value={`${r.material} - ${r.color}`}>
                            {r.material} - {r.color} ({r.brand} - {r.active !== false ? '🟢 Ativo' : '⚪ Inativo'})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 12 }}>Peso 2 (g)</label>
                      <input className="form-input" type="number" step="0.01" placeholder="10" value={form.weight2G} onChange={e => handleColorChange({ ...form, weight2G: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 12 }}>Tempo 2 (min)</label>
                      <input className="form-input" type="number" placeholder="45" value={form.time2Min} onChange={e => handleColorChange({ ...form, time2Min: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-row-3">
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 12 }}>🎨 Cor 3 (Opcional)</label>
                      <select className="form-select" value={form.color3} onChange={e => handleColorChange({ ...form, color3: e.target.value })}>
                        <option value="">Nenhuma ou selecione...</option>
                        {rolls.map(r => (
                          <option key={r.id} value={`${r.material} - ${r.color}`}>
                            {r.material} - {r.color} ({r.brand} - {r.active !== false ? '🟢 Ativo' : '⚪ Inativo'})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 12 }}>Peso 3 (g)</label>
                      <input className="form-input" type="number" step="0.01" placeholder="5" value={form.weight3G} onChange={e => handleColorChange({ ...form, weight3G: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 12 }}>Tempo 3 (min)</label>
                      <input className="form-input" type="number" placeholder="15" value={form.time3Min} onChange={e => handleColorChange({ ...form, time3Min: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">⚖️ Peso Total Acumulado (g)</label>
                    <input className="form-input" type="number" step="0.01" value={form.estimatedWeightG} onChange={e => setForm({ ...form, estimatedWeightG: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">⏱️ Tempo Total Acumulado (min)</label>
                    <input className="form-input" type="number" value={form.estimatedPrintMinutes} onChange={e => setForm({ ...form, estimatedPrintMinutes: e.target.value })} required />
                  </div>
                </div>

                <h3 style={{ fontSize: 14, color: '#34d399', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6, margin: '20px 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Wrench size={16} /> Insumos Extras & Hardware (Argolas, Embalagens)
                </h3>
                <div style={{ background: 'rgba(16, 185, 129, 0.04)', padding: 12, borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                  <div className="form-row" style={{ marginBottom: 10 }}>
                    <div className="form-group" style={{ flex: 2 }}>
                      <label className="form-label" style={{ fontSize: 12 }}>Item Extra 1</label>
                      <select className="form-select" value={form.extra1Name} onChange={e => setForm({ ...form, extra1Name: e.target.value })}>
                        <option value="">Nenhum ou selecione insumo...</option>
                        {supplies.map(s => (
                          <option key={s.id} value={s.name}>
                            {s.name} ({formatCurrency(s.unitCost)} / un)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 12 }}>Quantidade 1</label>
                      <input className="form-input" type="number" placeholder="1" value={form.extra1Qty} onChange={e => setForm({ ...form, extra1Qty: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 2 }}>
                      <label className="form-label" style={{ fontSize: 12 }}>Item Extra 2 (Opcional)</label>
                      <select className="form-select" value={form.extra2Name} onChange={e => setForm({ ...form, extra2Name: e.target.value })}>
                        <option value="">Nenhum ou selecione insumo...</option>
                        {supplies.map(s => (
                          <option key={s.id} value={s.name}>
                            {s.name} ({formatCurrency(s.unitCost)} / un)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 12 }}>Quantidade 2</label>
                      <input className="form-input" type="number" placeholder="1" value={form.extra2Qty} onChange={e => setForm({ ...form, extra2Qty: e.target.value })} />
                    </div>
                  </div>
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Salvar Alterações' : 'Cadastrar Peça V2'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
