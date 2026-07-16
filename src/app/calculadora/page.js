'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  Calculator, Palette, Wrench, DollarSign, Package, Factory,
  TrendingUp, RefreshCw, CheckCircle2, ArrowRight, AlertTriangle, Sparkles
} from 'lucide-react';
import { formatCurrency, formatWeight, formatDuration, formatPercent } from '@/lib/formatters';
import { calculateEnergyCost } from '@/lib/calculations';

export default function CalculadoraPage() {
  const [products, setProducts] = useState([]);
  const [rolls, setRolls] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [machines, setMachines] = useState([]);
  const [kwhPrice, setKwhPrice] = useState(0.85);
  const [loading, setLoading] = useState(true);

  // Selected state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedMachineId, setSelectedMachineId] = useState('');

  // Overrides and slots
  const [printMinutes, setPrintMinutes] = useState(120);
  const [powerWatts, setPowerWatts] = useState(200);
  const [marginPct, setMarginPct] = useState(50);
  const [customSalePrice, setCustomSalePrice] = useState('');

  // 3 Color Slots
  const [colors, setColors] = useState([
    { name: 'Cor 1', weight: 0, rollId: '' },
    { name: 'Cor 2', weight: 0, rollId: '' },
    { name: 'Cor 3', weight: 0, rollId: '' },
  ]);

  // 2 Extra Hardware Slots
  const [extras, setExtras] = useState([
    { name: '', qty: 0, supplyId: '' },
    { name: '', qty: 0, supplyId: '' },
  ]);

  const [orderCreated, setOrderCreated] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [pRes, rRes, sRes, mRes, eRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/filament-rolls'),
        fetch('/api/supplies'),
        fetch('/api/machines'),
        fetch('/api/energy-config'),
      ]);
      const pData = await pRes.json();
      const rData = await rRes.json();
      const sData = await sRes.json();
      const mData = await mRes.json();
      const eData = await eRes.json();

      const pArr = Array.isArray(pData) ? pData : [];
      const rArr = Array.isArray(rData) ? rData : [];
      const sArr = Array.isArray(sData) ? sData : [];
      const mArr = Array.isArray(mData) ? mData : [];

      setProducts(pArr);
      setRolls(rArr);
      setSupplies(sArr);
      setMachines(mArr);
      if (Array.isArray(eData) && eData[0]) setKwhPrice(Number(eData[0].kwhPrice));

      const defaultMach = mArr.find(m => m.status === 'ACTIVE') || mArr[0];
      if (defaultMach) {
        setSelectedMachineId(defaultMach.id);
        setPowerWatts(Number(defaultMach.powerWatts) || 200);
      }
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Load product data when selected
  const handleSelectProduct = (id) => {
    setSelectedProductId(id);
    setOrderCreated(false);
    const prod = products.find(p => p.id === Number(id));
    if (!prod) return;

    setPrintMinutes(Number(prod.estimatedPrintMinutes) || 120);
    if (prod.powerWatts) setPowerWatts(Number(prod.powerWatts));
    setMarginPct(Number(prod.profitMarginPct) || 50);
    setCustomSalePrice(prod.salePrice ? String(prod.salePrice) : '');

    const defaultRollId = rolls[0]?.id || '';

    const matchRoll = (colorVal) => {
      if (!colorVal) return '';
      const found = rolls.find(r =>
        `${r.material} - ${r.color}` === colorVal ||
        r.color.toLowerCase() === colorVal.toLowerCase() ||
        colorVal.toLowerCase().includes(r.color.toLowerCase())
      );
      return found ? found.id : '';
    };

    // Cores
    const newColors = [
      {
        name: prod.color1 || (prod.recommendedColor || 'Cor Principal'),
        weight: Number(prod.weight1G) || Number(prod.estimatedWeightG) || 0,
        rollId: matchRoll(prod.color1) || defaultRollId,
      },
      {
        name: prod.color2 || 'Cor 2',
        weight: Number(prod.weight2G) || 0,
        rollId: prod.weight2G ? (matchRoll(prod.color2) || defaultRollId) : '',
      },
      {
        name: prod.color3 || 'Cor 3',
        weight: Number(prod.weight3G) || 0,
        rollId: prod.weight3G ? (matchRoll(prod.color3) || defaultRollId) : '',
      },
    ];
    setColors(newColors);

    // Extras
    const matchSupply1 = supplies.find(s => s.name.toLowerCase() === (prod.extra1Name || '').toLowerCase() || s.name.toLowerCase().includes((prod.extra1Name || '').toLowerCase()));
    const matchSupply2 = supplies.find(s => s.name.toLowerCase() === (prod.extra2Name || '').toLowerCase() || s.name.toLowerCase().includes((prod.extra2Name || '').toLowerCase()));
    setExtras([
      { name: prod.extra1Name || '', qty: Number(prod.extra1Qty) || 0, supplyId: matchSupply1?.id || '' },
      { name: prod.extra2Name || '', qty: Number(prod.extra2Qty) || 0, supplyId: matchSupply2?.id || '' },
    ]);
  };

  const updateColorSlot = (index, field, value) => {
    const next = [...colors];
    next[index] = { ...next[index], [field]: field === 'weight' ? Number(value) : value };
    setColors(next);
  };

  const updateExtraSlot = (index, field, value) => {
    const next = [...extras];
    next[index] = { ...next[index], [field]: field === 'qty' ? Number(value) : value };
    setExtras(next);
  };

  // Calculations
  const calcMaterialCost = () => {
    return colors.reduce((acc, slot) => {
      if (!slot.weight || slot.weight <= 0) return acc;
      const roll = rolls.find(r => r.id === Number(slot.rollId)) || rolls[0];
      const cpg = roll ? Number(roll.costPerGram) : 0.12;
      return acc + (slot.weight * cpg);
    }, 0);
  };

  const calcHardwareCost = () => {
    return extras.reduce((acc, slot) => {
      if (!slot.qty || slot.qty <= 0) return acc;
      const sup = supplies.find(s => s.id === Number(slot.supplyId));
      const uc = sup ? Number(sup.unitCost) : 0;
      return acc + (slot.qty * uc);
    }, 0);
  };

  const matCost = calcMaterialCost();
  const hwCost = calcHardwareCost();
  const enCost = calculateEnergyCost(powerWatts, printMinutes, kwhPrice);
  const totalCost = matCost + hwCost + enCost;

  const totalWeight = colors.reduce((a, b) => a + (Number(b.weight) || 0), 0);

  // Preço de venda
  const dynamicSuggestedPrice = marginPct < 100 ? totalCost / (1 - (marginPct / 100)) : totalCost * 2;
  const finalSalePrice = customSalePrice !== '' && !isNaN(customSalePrice) ? Number(customSalePrice) : dynamicSuggestedPrice;
  const netProfit = finalSalePrice - totalCost;
  const netMarginPct = finalSalePrice > 0 ? (netProfit / finalSalePrice) * 100 : 0;

  const handleCreateOrder = async () => {
    if (!selectedProductId || !selectedMachineId) {
      alert('Selecione um Modelo e uma Máquina para gerar a ordem.');
      return;
    }
    const primaryRollId = colors.find(c => c.rollId && c.weight > 0)?.rollId || rolls[0]?.id;
    if (!primaryRollId) {
      alert('Selecione pelo menos um filamento ativo para a impressão.');
      return;
    }

    const colorDetails = colors.filter(c => c.weight > 0).map(c => `${c.name}: ${c.weight}g (${rolls.find(r => r.id === Number(c.rollId))?.color || 'Filamento'})`).join(' | ');
    const extraDetails = extras.filter(e => e.qty > 0).map(e => `${e.qty}x ${e.name}`).join(' | ');
    const notes = `[Calculadora] Composição: ${colorDetails || totalWeight + 'g'}${extraDetails ? ' + Extras: ' + extraDetails : ''}. Custo Real Estimado: R$ ${totalCost.toFixed(2)}`;

    try {
      const res = await fetch('/api/production-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: Number(selectedProductId),
          filamentRollId: Number(primaryRollId),
          machineId: Number(selectedMachineId),
          notes,
        }),
      });
      if (res.ok) {
        setOrderCreated(true);
      } else {
        alert('Erro ao gerar ordem de produção.');
      }
    } catch {
      alert('Erro de conexão ao gerar ordem.');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles className="text-amber-400" size={24} /> Calculadora de Impressão
          </h1>
          <p className="page-subtitle">Simulação dinâmica multicolorida (3 Cores) + Insumos de Hardware + Override na hora</p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24 }}>
          {/* PAINEL DE ENTRADAS & OVERRIDE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="table-container" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Package className="text-indigo-400" size={20} />
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>1. Seleção de Peça & Máquina</h3>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Carregar Modelo do Catálogo</label>
                  <select className="form-select" value={selectedProductId} onChange={e => handleSelectProduct(e.target.value)}>
                    <option value="">Selecione para preencher fórmulas da planilha...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({formatWeight(p.estimatedWeightG)})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Máquina de Impressão</label>
                  <select className="form-select" value={selectedMachineId} onChange={e => {
                    setSelectedMachineId(e.target.value);
                    const m = machines.find(item => item.id === Number(e.target.value));
                    if (m) setPowerWatts(Number(m.powerWatts) || 200);
                  }}>
                    {machines.filter(m => m.status === 'ACTIVE').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* CORES & PESOS (OVERRIDE LIVRE) */}
            <div className="table-container" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Palette className="text-sky-400" size={20} />
                  <h3 style={{ fontSize: 16, fontWeight: 600 }}>2. Composição de Cores e Filamentos Ativos</h3>
                </div>
                <span style={{ fontSize: 12, color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '3px 8px', borderRadius: 12 }}>
                  Edite os pesos (g) livremente na hora
                </span>
              </div>

              {colors.map((slot, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.6fr', gap: 12, marginBottom: 12, background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Nome da Cor / Parte #{idx + 1}</label>
                    <input className="form-input" placeholder={`Ex: Cor ${idx + 1}`} value={slot.name} onChange={e => updateColorSlot(idx, 'name', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Peso (g)</label>
                    <input className="form-input" type="number" step="0.1" value={slot.weight} onChange={e => updateColorSlot(idx, 'weight', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Filamento Ativo (Preço Base/g)</label>
                    <select className="form-select" value={slot.rollId} onChange={e => updateColorSlot(idx, 'rollId', e.target.value)}>
                      <option value="">Selecione filamento ativo...</option>
                      {rolls.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.material} {r.color} ({r.brand} - R$ {Number(r.costPerGram).toFixed(4)}/g)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#94a3b8', padding: '6px 4px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span>Peso Total da Peça: <strong>{formatWeight(totalWeight)}</strong></span>
                <span>Custo de Plástico Calc: <strong style={{ color: '#38bdf8' }}>{formatCurrency(matCost)}</strong></span>
              </div>
            </div>

            {/* INSUMOS EXTRAS E HARDWARE */}
            <div className="table-container" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Wrench className="text-emerald-400" size={20} />
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>3. Insumos Extras & Hardware (Argolas, Embalagem)</h3>
              </div>
              {extras.map((slot, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 1.6fr', gap: 12, marginBottom: 12, background: 'rgba(16,185,129,0.02)', padding: 12, borderRadius: 8, border: '1px solid rgba(16,185,129,0.1)' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Nome do Hardware #{idx + 1}</label>
                    <input className="form-input" placeholder={idx === 0 ? 'Ex: Argola Chaveiro' : 'Ex: Embalagem Plástica'} value={slot.name} onChange={e => updateExtraSlot(idx, 'name', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Quantidade</label>
                    <input className="form-input" type="number" value={slot.qty} onChange={e => updateExtraSlot(idx, 'qty', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Vincular ao Catálogo de Insumos</label>
                    <select className="form-select" value={slot.supplyId} onChange={e => updateExtraSlot(idx, 'supplyId', e.target.value)}>
                      <option value="">Selecione para puxar preço unitário...</option>
                      {supplies.map(s => <option key={s.id} value={s.id}>{s.name} (R$ {Number(s.unitCost).toFixed(2)}/un)</option>)}
                    </select>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 13, color: '#94a3b8', padding: '6px 4px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <span>Custo de Hardware/Extras Calc: <strong style={{ color: '#34d399' }}>{formatCurrency(hwCost)}</strong></span>
              </div>
            </div>

            {/* TEMPO E ENERGIA */}
            <div className="table-container" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Factory className="text-amber-400" size={20} />
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>4. Tempo de Impressão & Consumo de Energia</h3>
              </div>
              <div className="form-row-3">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Tempo Total (min)</label>
                  <input className="form-input" type="number" value={printMinutes} onChange={e => setPrintMinutes(Number(e.target.value))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Potência da Máquina (W)</label>
                  <input className="form-input" type="number" value={powerWatts} onChange={e => setPowerWatts(Number(e.target.value))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Custo Energia (Calc)</label>
                  <div className="form-input" style={{ background: 'rgba(255,255,255,0.03)', fontWeight: 600, color: '#fbbf24', display: 'flex', alignItems: 'center' }}>
                    {formatCurrency(enCost)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PAINEL DE RESUMO & LUCRO (LADO DIREITO) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="table-container" style={{ padding: 24, background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.85) 100%)', border: '1px solid rgba(129, 140, 248, 0.3)' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#818cf8', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={22} /> Resumo Financeiro da Peça
              </h3>

              {/* Breakdown de custos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: '#94a3b8' }}>Plástico / Filamento ({formatWeight(totalWeight)}):</span>
                  <strong style={{ color: '#38bdf8' }}>{formatCurrency(matCost)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: '#94a3b8' }}>Hardware / Insumos Extras:</span>
                  <strong style={{ color: '#34d399' }}>{formatCurrency(hwCost)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: '#94a3b8' }}>Energia Elétrica ({formatDuration(printMinutes)}):</span>
                  <strong style={{ color: '#fbbf24' }}>{formatCurrency(enCost)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, paddingTop: 8, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                  <span>CUSTO REAL DE PRODUÇÃO:</span>
                  <span style={{ color: '#f43f5e', fontSize: 18 }}>{formatCurrency(totalCost)}</span>
                </div>
              </div>

              {/* Preços e Margem */}
              <div style={{ marginBottom: 20 }}>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Margem de Lucro Alvo (%)</span>
                    <strong style={{ color: '#818cf8' }}>{marginPct}%</strong>
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={marginPct}
                    onChange={e => { setMarginPct(Number(e.target.value)); setCustomSalePrice(''); }}
                    style={{ width: '100%', accentColor: '#818cf8', cursor: 'pointer' }}
                  />
                </div>
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label className="form-label">Preço de Venda Praticado / Anunciado (R$)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    placeholder={`Sugestão (${marginPct}%): ${formatCurrency(dynamicSuggestedPrice)}`}
                    value={customSalePrice}
                    onChange={e => setCustomSalePrice(e.target.value)}
                    style={{ fontSize: 16, fontWeight: 600, color: '#10b981' }}
                  />
                </div>
              </div>

              {/* Card de Lucro Líquido Final */}
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 12, padding: 18, textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 13, color: '#34d399', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Lucro Líquido Limpo por Peça</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981', margin: '6px 0' }}>{formatCurrency(netProfit)}</div>
                <div style={{ fontSize: 14, color: '#94a3b8' }}>Margem Real Efetiva: <strong style={{ color: netMarginPct >= 40 ? '#34d399' : '#fbbf24' }}>{formatPercent(netMarginPct)}</strong></div>
              </div>

              {/* Botão de 1 Clique para gerar ordem */}
              {orderCreated ? (
                <div className="alert alert-success" style={{ textAlign: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={20} />
                  <div>
                    <strong>Ordem de Produção Gerada com Sucesso!</strong>
                    <div style={{ fontSize: 12, marginTop: 2 }}>Acompanhe em Produção com os custos já gravados.</div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCreateOrder}
                  disabled={!selectedProductId}
                  style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)' }}
                >
                  <ArrowRight size={18} /> Transformar em Ordem de Produção
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
