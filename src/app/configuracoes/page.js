'use client';
import { useState, useEffect, useCallback } from 'react';
import { Settings, Printer, Zap, Plus, Trash2, X, Database, ToggleRight, ToggleLeft } from 'lucide-react';
import { formatCurrency, formatDate, machineStatusLabels } from '@/lib/formatters';

export default function ConfiguracoesPage() {
  const [machines, setMachines] = useState([]);
  const [energyConfigs, setEnergyConfigs] = useState([]);
  const [granularMode, setGranularMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [showMachineModal, setShowMachineModal] = useState(false);
  const [showEnergyModal, setShowEnergyModal] = useState(false);
  const [machineForm, setMachineForm] = useState({ name: '', purchasePrice: '', installmentCount: '12', installmentValue: '', powerWatts: '', purchaseDate: '' });
  const [energyForm, setEnergyForm] = useState({ kwhPrice: '', utilityName: '', effectiveDate: '' });

  const fetchData = useCallback(async () => {
    try {
      const [mRes, eRes, cfgRes] = await Promise.all([
        fetch('/api/machines'),
        fetch('/api/energy-config'),
        fetch('/api/system-config'),
      ]);
      setMachines(await mRes.json().then(d => Array.isArray(d) ? d : []));
      setEnergyConfigs(await eRes.json().then(d => Array.isArray(d) ? d : []));
      const config = await cfgRes.json();
      setGranularMode(config?.modo_estoque_granular?.value === 'true');
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleToggleGranular = async () => {
    setToggling(true);
    const newValue = !granularMode;
    try {
      await fetch('/api/system-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'modo_estoque_granular', value: String(newValue) }),
      });
      setGranularMode(newValue);
    } catch { /* rollback */ }
    finally { setToggling(false); }
  };

  const handleMachineSubmit = async (e) => {
    e.preventDefault();
    await fetch('/api/machines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(machineForm) });
    setShowMachineModal(false);
    fetchData();
  };

  const handleEnergySubmit = async (e) => {
    e.preventDefault();
    await fetch('/api/energy-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(energyForm) });
    setShowEnergyModal(false);
    fetchData();
  };

  const deleteMachine = async (id) => {
    if (!confirm('Remover esta máquina?')) return;
    await fetch(`/api/machines?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Configurações</h1><p className="page-subtitle">Máquinas, energia e regras de estoque</p></div>
      </div>

      {/* ============================================ */}
      {/* CHAVE DE ESTOQUE GRANULAR — Liga / Desliga */}
      {/* ============================================ */}
      <div style={{ marginBottom: 28 }}>
        <div className="config-toggle-card" style={{ opacity: toggling ? 0.6 : 1 }}>
          <div style={{
            width: 50, height: 50, borderRadius: 12,
            background: granularMode ? 'rgba(52, 211, 153, 0.15)' : 'rgba(107, 114, 128, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: granularMode ? '#34d399' : '#6b7280',
            transition: 'all 0.3s ease',
            flexShrink: 0,
          }}>
            <Database size={24} />
          </div>
          <div className="config-toggle-info">
            <div className="config-toggle-title">
              ⚙️ Chave de Estoque Granular
            </div>
            <div className="config-toggle-desc">
              {granularMode ? (
                <>
                  <strong style={{ color: '#34d399' }}>LIGADO — Controle por Gramas:</strong> O sistema exige o peso
                  inicial de cada rolo de filamento. Ao concluir ou falhar uma OP, o peso da peça é subtraído automaticamente
                  do saldo em gramas do rolo. Ideal para controle rigoroso de material e custos.
                </>
              ) : (
                <>
                  <strong style={{ color: '#9ca3af' }}>DESLIGADO — Estoque Simplificado:</strong> O sistema ignora as
                  quantidades em gramas. Você apenas marca se uma cor/material está &quot;Ativa&quot; ou &quot;Inativa&quot;.
                  Nenhuma subtração ocorre ao finalizar uma impressão. O cálculo de custo continua funcionando normalmente.
                </>
              )}
            </div>
            <div className={`config-toggle-status ${granularMode ? 'active' : 'inactive'}`}>
              {granularMode ? (
                <><ToggleRight size={14} /> Granular — Subtrai Gramas Automaticamente</>
              ) : (
                <><ToggleLeft size={14} /> Simplificado — Apenas Ativo / Inativo</>
              )}
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={granularMode}
              onChange={handleToggleGranular}
              disabled={toggling}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div className="grid-2">
        {/* Machines */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><Printer size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />Impressoras 3D</h3>
            <button className="btn btn-primary btn-sm" onClick={() => { setMachineForm({ name: '', purchasePrice: '', installmentCount: '12', installmentValue: '', powerWatts: '', purchaseDate: '' }); setShowMachineModal(true); }}><Plus size={14} /> Adicionar</button>
          </div>
          <div className="card-body">
            {machines.length === 0 ? (
              <div className="empty-state" style={{ padding: 30 }}><Printer /><div className="empty-state-title">Nenhuma máquina</div></div>
            ) : machines.map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-primary)' }}>
                <div>
                  <strong>{m.name}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatCurrency(m.purchasePrice)} · {m.powerWatts}W · {machineStatusLabels[m.status]}</div>
                </div>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => deleteMachine(m.id)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Energy Config */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><Zap size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />Tarifa de Energia</h3>
            <button className="btn btn-primary btn-sm" onClick={() => { setEnergyForm({ kwhPrice: '', utilityName: '', effectiveDate: '' }); setShowEnergyModal(true); }}><Plus size={14} /> Nova Tarifa</button>
          </div>
          <div className="card-body">
            {energyConfigs.length === 0 ? (
              <div className="empty-state" style={{ padding: 30 }}><Zap /><div className="empty-state-title">Nenhuma tarifa configurada</div></div>
            ) : energyConfigs.map(c => (
              <div key={c.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{formatCurrency(c.kwhPrice)}/kWh</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatDate(c.effectiveDate)}</span>
                </div>
                {c.utilityName && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.utilityName}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Machine Modal */}
      {showMachineModal && (
        <div className="modal-overlay" onClick={() => setShowMachineModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 className="modal-title">Nova Impressora</h2><button className="modal-close" onClick={() => setShowMachineModal(false)}><X size={18} /></button></div>
            <form onSubmit={handleMachineSubmit}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Nome</label><input className="form-input" placeholder="Ender 3 V3" value={machineForm.name} onChange={e => setMachineForm({ ...machineForm, name: e.target.value })} required /></div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Preço de Compra (R$)</label><input className="form-input" type="number" step="0.01" value={machineForm.purchasePrice} onChange={e => setMachineForm({ ...machineForm, purchasePrice: e.target.value })} required /></div>
                  <div className="form-group"><label className="form-label">Potência (Watts)</label><input className="form-input" type="number" value={machineForm.powerWatts} onChange={e => setMachineForm({ ...machineForm, powerWatts: e.target.value })} required /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Nº Parcelas</label><input className="form-input" type="number" value={machineForm.installmentCount} onChange={e => setMachineForm({ ...machineForm, installmentCount: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Valor Parcela (R$)</label><input className="form-input" type="number" step="0.01" value={machineForm.installmentValue} onChange={e => setMachineForm({ ...machineForm, installmentValue: e.target.value })} /></div>
                </div>
                <div className="form-group"><label className="form-label">Data de Compra</label><input className="form-input" type="date" value={machineForm.purchaseDate} onChange={e => setMachineForm({ ...machineForm, purchaseDate: e.target.value })} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={() => setShowMachineModal(false)}>Cancelar</button><button type="submit" className="btn btn-primary">Cadastrar</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Energy Modal */}
      {showEnergyModal && (
        <div className="modal-overlay" onClick={() => setShowEnergyModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 className="modal-title">Nova Tarifa de Energia</h2><button className="modal-close" onClick={() => setShowEnergyModal(false)}><X size={18} /></button></div>
            <form onSubmit={handleEnergySubmit}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Preço kWh (R$)</label><input className="form-input" type="number" step="0.0001" placeholder="0.85" value={energyForm.kwhPrice} onChange={e => setEnergyForm({ ...energyForm, kwhPrice: e.target.value })} required /></div>
                <div className="form-group"><label className="form-label">Concessionária</label><input className="form-input" placeholder="CEMIG, CPFL, etc." value={energyForm.utilityName} onChange={e => setEnergyForm({ ...energyForm, utilityName: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Data de Vigência</label><input className="form-input" type="date" value={energyForm.effectiveDate} onChange={e => setEnergyForm({ ...energyForm, effectiveDate: e.target.value })} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={() => setShowEnergyModal(false)}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
