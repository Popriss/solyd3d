'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Factory, CheckCircle, XCircle, Clock, PlayCircle,
  X, AlertTriangle, Trash2, Wrench, FileCode2, Package,
  Printer, MapPin, Scale, Timer, Layers, Edit3, PlusCircle
} from 'lucide-react';
import { formatCurrency, formatWeight, formatDuration, orderStatusLabels } from '@/lib/formatters';

// Kanban column definitions
const KANBAN_COLUMNS = [
  { status: 'QUEUED', label: 'Na Fila', icon: Clock, cssClass: 'col-queued', emptyText: 'Nenhuma chapa na fila' },
  { status: 'SLICED', label: 'Fatiado', icon: FileCode2, cssClass: 'col-sliced', emptyText: 'Nenhum G-code pronto' },
  { status: 'PRINTING', label: 'Imprimindo', icon: PlayCircle, cssClass: 'col-printing', emptyText: 'Nenhuma impressão ativa' },
  { status: 'POST_PROCESSING', label: 'Pós-Processamento', icon: Wrench, cssClass: 'col-post', emptyText: 'Nada em acabamento' },
  { status: 'COMPLETED', label: 'Concluído', icon: CheckCircle, cssClass: 'col-completed', emptyText: 'Nenhuma chapa finalizada' },
  { status: 'FAILED', label: 'Falha / Scrap', icon: XCircle, cssClass: 'col-failed', emptyText: 'Nenhuma falha registrada' },
];

export default function ProducaoPage() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [rolls, setRolls] = useState([]);
  const [machines, setMachines] = useState([]);
  const [salesPoints, setSalesPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [granularMode, setGranularMode] = useState(false);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState({ productId: '', filamentRollId: '', machineId: '', quantity: '1', destinationType: 'DIRECT_SALE', destinationName: '', notes: '' });
  const [editTaskForm, setEditTaskForm] = useState({ targetCycles: '1', machineId: '', filamentRollId: '', status: 'QUEUED' });

  // Drag state
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [ordersRes, productsRes, rollsRes, machinesRes, spRes, configRes] = await Promise.all([
        fetch('/api/production-orders'),
        fetch('/api/products'),
        fetch('/api/filament-rolls'),
        fetch('/api/machines'),
        fetch('/api/sales-points'),
        fetch('/api/system-config'),
      ]);
      setOrders(await ordersRes.json().then(d => Array.isArray(d) ? d : []));
      setProducts(await productsRes.json().then(d => Array.isArray(d) ? d : []));
      setRolls(await rollsRes.json().then(d => Array.isArray(d) ? d : []));
      setMachines(await machinesRes.json().then(d => Array.isArray(d) ? d : []));
      setSalesPoints(await spRes.json().then(d => Array.isArray(d) ? d : []));
      const config = await configRes.json();
      setGranularMode(config?.modo_estoque_granular?.value === 'true');
    } catch { /* empty */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Transformar as ordens e suas PrintTasks em uma lista plana para o Kanban
  const allTasks = orders.flatMap(o => (o.printTasks || []).map(pt => ({
    ...pt,
    productionOrder: o,
  })));

  // ========================================
  // DRAG AND DROP HANDLERS (HTML5 API)
  // ========================================
  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(taskId));
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-task-id="${taskId}"]`);
      if (el) el.classList.add('dragging');
    });
  };

  const handleDragEnd = () => {
    const el = document.querySelector(`[data-task-id="${draggedTaskId}"]`);
    if (el) el.classList.remove('dragging');
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e, status) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = Number(e.dataTransfer.getData('text/plain'));
    const task = allTasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Atualização otimista no front
    setOrders(prev => prev.map(o => ({
      ...o,
      printTasks: (o.printTasks || []).map(t => t.id === taskId ? { ...t, status: newStatus } : t)
    })));

    try {
      const res = await fetch(`/api/print-tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Falha ao mover tarefa');
      fetchAll();
    } catch {
      fetchAll();
    }
  };

  // ========================================
  // BOTÃO +1 (INCREMENTO DE CICLO)
  // ========================================
  const handleIncrement = async (taskId) => {
    try {
      const res = await fetch(`/api/print-tasks/${taskId}/increment`, {
        method: 'PUT',
      });
      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || 'Erro ao incrementar ciclo');
        return;
      }
      fetchAll();
    } catch (err) {
      alert('Erro na comunicação com servidor.');
    }
  };

  // ========================================
  // EDITAR TAREFA KANBAN (targetCycles, machine, roll)
  // ========================================
  const openEditTask = (task) => {
    setEditingTask(task);
    setEditTaskForm({
      targetCycles: String(task.targetCycles || 1),
      machineId: task.machineId ? String(task.machineId) : (task.productionOrder?.machineId ? String(task.productionOrder.machineId) : ''),
      filamentRollId: task.filamentRollId ? String(task.filamentRollId) : (task.productionOrder?.filamentRollId ? String(task.productionOrder.filamentRollId) : ''),
      status: task.status || 'QUEUED',
    });
    setShowEditTaskModal(true);
  };

  const handleSaveEditTask = async (e) => {
    e.preventDefault();
    if (!editingTask) return;

    try {
      const res = await fetch(`/api/print-tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetCycles: Number(editTaskForm.targetCycles),
          machineId: editTaskForm.machineId ? Number(editTaskForm.machineId) : null,
          filamentRollId: editTaskForm.filamentRollId ? Number(editTaskForm.filamentRollId) : null,
          status: editTaskForm.status,
        }),
      });
      if (!res.ok) throw new Error('Erro ao salvar edições da tarefa');
      setShowEditTaskModal(false);
      fetchAll();
    } catch (err) {
      alert(err.message || 'Erro ao atualizar');
    }
  };

  // ========================================
  // CREATE ORDER
  // ========================================
  const handleCreate = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/production-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || 'Erro ao criar ordem');
      return;
    }
    setShowModal(false);
    fetchAll();
  };

  const handleDeleteOrder = async (id) => {
    if (!confirm('Remover este lote de produção (OP Pai e todas as suas chapas)?')) return;
    await fetch(`/api/production-orders?id=${id}`, { method: 'DELETE' });
    fetchAll();
  };

  // ========================================
  // COMPUTED VALUES
  // ========================================
  const availableRolls = rolls.filter(r => r.active !== false);
  const completedTasks = allTasks.filter(t => t.status === 'COMPLETED').length;
  const failedTasks = allTasks.filter(t => t.status === 'FAILED').length;
  const printingTasks = allTasks.filter(t => t.status === 'PRINTING').length;

  const getTasksByStatus = (status) => allTasks.filter(t => t.status === status);

  return (
    <div className="page-container" style={{ maxWidth: 1800 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Kanban de Produção & BOM Batching</h1>
          <p className="page-subtitle">
            Cartões granulares por Chapa (.Gcode) com multiplicadores de ciclo
            {granularMode && (
              <span style={{ marginLeft: 8, color: '#34d399', fontWeight: 600 }}>
                ⚡ Estoque Granular LIGADO (Baixa a cada +1 ciclo)
              </span>
            )}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ productId: '', filamentRollId: '', machineId: '', quantity: '1', destinationType: 'DIRECT_SALE', destinationName: '', notes: '' }); setShowModal(true); }}>
          <Plus size={16} /> Novo Lote (OP)
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card indigo">
          <div className="stat-card-header"><div className="stat-card-icon indigo"><Factory size={20} /></div></div>
          <div className="stat-card-label">Lotes (OPs Pais)</div>
          <div className="stat-card-value">{orders.length}</div>
        </div>
        <div className="stat-card cyan">
          <div className="stat-card-header"><div className="stat-card-icon cyan"><PlayCircle size={20} /></div></div>
          <div className="stat-card-label">Chapas Imprimindo Agora</div>
          <div className="stat-card-value">{printingTasks}</div>
        </div>
        <div className="stat-card emerald">
          <div className="stat-card-header"><div className="stat-card-icon emerald"><CheckCircle size={20} /></div></div>
          <div className="stat-card-label">Chapas Concluídas</div>
          <div className="stat-card-value">{completedTasks}</div>
        </div>
        <div className="stat-card rose">
          <div className="stat-card-header"><div className="stat-card-icon rose"><XCircle size={20} /></div></div>
          <div className="stat-card-label">Falhas / Scrap</div>
          <div className="stat-card-value">{failedTasks}</div>
        </div>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <div className="spinner" style={{ width: 32, height: 32 }}></div>
        </div>
      ) : (
        <div className="kanban-board">
          {KANBAN_COLUMNS.map(column => {
            const columnTasks = getTasksByStatus(column.status);
            const Icon = column.icon;
            return (
              <div
                key={column.status}
                className={`kanban-column ${column.cssClass} ${dragOverColumn === column.status ? 'drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, column.status)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.status)}
              >
                <div className="kanban-column-header">
                  <div className="kanban-column-title">
                    <Icon />
                    {column.label}
                  </div>
                  <span className="kanban-column-count">{columnTasks.length}</span>
                </div>
                <div className="kanban-column-body">
                  {columnTasks.length === 0 ? (
                    <div className="kanban-empty">
                      <Icon />
                      <span>{column.emptyText}</span>
                    </div>
                  ) : (
                    columnTasks.map((task, idx) => (
                      <KanbanTaskCard
                        key={task.id}
                        task={task}
                        index={idx}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDeleteOrder={handleDeleteOrder}
                        onIncrement={handleIncrement}
                        onEdit={openEditTask}
                        router={router}
                        granularMode={granularMode}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================ */}
      {/* MODAL: Nova Ordem de Produção (Lote BOM) */}
      {/* ============================================ */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Novo Lote de Produção (BOM)</h2>
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
                      {products.map(p => {
                        const platesCount = p.plates ? p.plates.length : 0;
                        return (
                          <option key={p.id} value={p.id}>
                            {p.name} ({formatWeight(p.estimatedWeightG)}) {platesCount > 0 ? `[${platesCount} Chapas BOM]` : '[Chapa Única]'}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Quantidade de Produtos (Kits/Peças)</label>
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
                    💡 <strong>Gatilho Reverso de Venda:</strong> Ao criar esta OP, geraremos automaticamente uma cobrança para <strong>{form.destinationName}</strong> na aba de <strong>Vendas</strong>!
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Filamento Padrão (Pode ser alterado por chapa depois)</label>
                  <select className="form-select" value={form.filamentRollId} onChange={e => setForm({ ...form, filamentRollId: e.target.value })} required>
                    <option value="">Selecionar filamento ativo...</option>
                    {availableRolls.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.material} {r.color} — {r.brand} (R$ {Number(r.costPerGram).toFixed(4)}/g)
                        {granularMode && r.remainingWeightG != null ? ` [${Number(r.remainingWeightG).toFixed(0)}g restantes]` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Máquina Padrão do Lote</label>
                  <select className="form-select" value={form.machineId} onChange={e => setForm({ ...form, machineId: e.target.value })} required>
                    <option value="">Selecionar máquina...</option>
                    {machines.filter(m => m.status === 'ACTIVE').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Observações (opcional)</label>
                  <textarea className="form-textarea" placeholder="Notas gerais sobre o lote..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={!form.productId || !form.filamentRollId || !form.machineId}>Gerar Lote & Tarefas</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* MODAL: Editar Chapa/Tarefa no Kanban */}
      {/* ============================================ */}
      {showEditTaskModal && editingTask && (
        <div className="modal-overlay" onClick={() => setShowEditTaskModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Editar Chapa #{editingTask.id} ({editingTask.productPlate?.name})</h2>
              <button className="modal-close" onClick={() => setShowEditTaskModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveEditTask}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Meta de Ciclos (targetCycles)</label>
                    <input className="form-input" type="number" min="1" value={editTaskForm.targetCycles} onChange={e => setEditTaskForm({ ...editTaskForm, targetCycles: e.target.value })} required />
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>Atual: {editingTask.completedCycles} concluídos</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status no Kanban</label>
                    <select className="form-select" value={editTaskForm.status} onChange={e => setEditTaskForm({ ...editTaskForm, status: e.target.value })}>
                      {KANBAN_COLUMNS.map(c => <option key={c.status} value={c.status}>{c.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Filamento/Rolo Específico Desta Chapa</label>
                  <select className="form-select" value={editTaskForm.filamentRollId} onChange={e => setEditTaskForm({ ...editTaskForm, filamentRollId: e.target.value })}>
                    <option value="">Usar padrão da OP Pai...</option>
                    {availableRolls.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.material} {r.color} ({r.brand})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Máquina Específica Desta Chapa</label>
                  <select className="form-select" value={editTaskForm.machineId} onChange={e => setEditTaskForm({ ...editTaskForm, machineId: e.target.value })}>
                    <option value="">Usar padrão da OP Pai...</option>
                    {machines.filter(m => m.status === 'ACTIVE').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowEditTaskModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// KANBAN TASK CARD COMPONENT (BOM / CHAPAS)
// ============================================
function KanbanTaskCard({ task, index, onDragStart, onDragEnd, onDeleteOrder, onIncrement, onEdit, router, granularMode }) {
  const order = task.productionOrder;
  if (!order) return null;

  const destLabel = order.destinationName || (
    order.destinationType === 'SALES_POINT' ? 'Ponto de Venda' :
    order.destinationType === 'ORDER' ? 'Encomenda' :
    'Venda Avulsa'
  );

  const isPrinting = task.status === 'PRINTING';
  const isCompleted = task.status === 'COMPLETED';
  const weight = task.productPlate?.estimatedWeightG;
  const time = task.productPlate?.estimatedPrintMinutes;

  const activeMachine = task.machine || order.machine;
  const activeRoll = task.filamentRoll || order.filamentRoll;

  return (
    <div
      className={`kanban-card ${isPrinting ? 'printing-pulse' : ''}`}
      draggable
      data-task-id={task.id}
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      style={{ animationDelay: `${index * 40}ms`, borderLeft: isCompleted ? '4px solid #34d399' : isPrinting ? '4px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Header: OP Pai + Chapa ID */}
      <div className="kanban-card-id" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="badge badge-purple" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>OP #{order.id}</span>
          <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>• Chapa #{task.id}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="kanban-card-delete" onClick={() => onEdit(task)} title="Editar chapa / multiplicador">
            <Edit3 size={12} />
          </button>
          <button className="kanban-card-delete" onClick={() => onDeleteOrder(order.id)} title="Excluir OP Pai e todas as chapas">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Title: Chapa Name & Product */}
      <div className="kanban-card-title" style={{ marginTop: 6 }}>
        <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.92rem' }}>
          🖨️ {task.productPlate?.name || 'Chapa'}
        </div>
        <div style={{ fontSize: '0.76rem', color: '#818cf8', marginTop: 2 }}>
          {order.product?.name || `Produto #${order.productId}`}
          {order.targetQuantity > 1 ? ` (Lote ${order.targetQuantity} un)` : ''}
        </div>
      </div>

      {/* Batch Progress Bar & +1 Button */}
      <div style={{ margin: '10px 0', background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: '0.74rem', color: '#cbd5e1', fontWeight: 600 }}>
            Progresso da Chapa: <strong style={{ color: isCompleted ? '#34d399' : '#38bdf8' }}>{task.completedCycles} / {task.targetCycles}</strong> rodadas
          </span>
          {!isCompleted && (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4, background: '#0284c7' }}
              onClick={() => onIncrement(task.id)}
              title="Registrar +1 impressão desta chapa"
            >
              <PlusCircle size={13} /> +1 Impressão
            </button>
          )}
        </div>
        <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.min(100, (task.completedCycles / task.targetCycles) * 100)}%`,
              height: '100%',
              background: isCompleted ? '#34d399' : '#38bdf8',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Meta info */}
      <div className="kanban-card-meta">
        <div className="kanban-card-meta-row">
          <MapPin size={12} />
          <span>{destLabel}</span>
        </div>
        <div className="kanban-card-meta-row">
          <Printer size={12} />
          <span>{activeMachine?.name || `Máquina #${task.machineId || order.machineId}`}</span>
        </div>
        {granularMode && activeRoll?.remainingWeightG != null && (
          <div className="kanban-card-meta-row" style={{ color: '#34d399' }}>
            <Package size={12} />
            <span>{Number(activeRoll.remainingWeightG).toFixed(0)}g no rolo</span>
          </div>
        )}
      </div>

      {/* Footer: Material + Time */}
      <div className="kanban-card-footer" style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
          {activeRoll && (
            <span className="kanban-card-material">
              {activeRoll.material} {activeRoll.color}
            </span>
          )}
          {order.saleId && (
            <button
              className="kanban-card-sale-link"
              onClick={(e) => { e.stopPropagation(); router.push(`/vendas?saleId=${order.saleId}`); }}
              title="Ver venda vinculada"
            >
              🛍️ #{order.saleId}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {weight && (
            <span className="kanban-card-time">
              <Scale size={11} />
              {formatWeight(weight)}
            </span>
          )}
          {time && (
            <span className="kanban-card-time">
              <Timer size={11} />
              {formatDuration(time)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
