'use client';
import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Trash2, X, Shield, UserCheck, Mail, Lock, AlertCircle, Activity, History, Filter } from 'lucide-react';
import { formatDate } from '@/lib/formatters';

export default function UsuariosPage() {
  const [activeTab, setActiveTab] = useState('logins'); // 'logins' ou 'audit'
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER',
  });

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/activity-logs?module=${moduleFilter}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(Array.isArray(data) ? data : []);
      }
    } catch {
      /* empty */
    } finally {
      setLoadingLogs(false);
    }
  }, [moduleFilter]);

  useEffect(() => {
    if (activeTab === 'logins') {
      fetchUsers();
    } else {
      fetchLogs();
    }
  }, [activeTab, fetchUsers, fetchLogs]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao criar login de usuário.');
      } else {
        setShowModal(false);
        setFormData({ name: '', email: '', password: '', role: 'USER' });
        fetchUsers();
      }
    } catch {
      setError('Erro de conexão ao tentar cadastrar o login.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateUserRole = async (id, currentRole, email) => {
    if (email === 'admin@solyd3d.com') {
      alert('O administrador master principal não pode alterar sua permissão.');
      return;
    }
    const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
    if (!confirm(`Alterar permissão de ${email} para ${newRole === 'ADMIN' ? 'Administrador' : 'Usuário Operacional'}?`)) return;

    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, role: newRole }),
      });
      if (res.ok) {
        fetchUsers();
      } else {
        alert('Erro ao atualizar permissão do usuário.');
      }
    } catch {
      alert('Erro de conexão ao atualizar usuário.');
    }
  };

  const deleteUser = async (id, email) => {
    if (email === 'admin@solyd3d.com') {
      alert('O administrador master principal não pode ser excluído.');
      return;
    }
    if (!confirm(`Remover o login de ${email}?`)) return;

    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erro ao remover login.');
      } else {
        fetchUsers();
      }
    } catch {
      alert('Erro ao comunicar com o servidor.');
    }
  };

  const adminCount = users.filter((u) => u.role === 'ADMIN').length;
  const userCount = users.filter((u) => u.role !== 'ADMIN').length;

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Usuários & Acessos</h1>
          <p className="page-subtitle">Gerencie os logins operacionais e audite todas as movimentações no ERP</p>
        </div>
        {activeTab === 'logins' && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setError('');
              setFormData({ name: '', email: '', password: '', role: 'USER' });
              setShowModal(true);
            }}
          >
            <Plus size={16} /> Novo Login
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '1px solid var(--border-primary)', paddingBottom: 12 }}>
        <button
          onClick={() => setActiveTab('logins')}
          className={`btn ${activeTab === 'logins' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Users size={16} /> Logins & Permissões
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`btn ${activeTab === 'audit' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <Activity size={16} /> Auditoria & Histórico de Movimentações
        </button>
      </div>

      {activeTab === 'logins' ? (
        <>
          <div className="metrics-grid" style={{ marginBottom: 24 }}>
            <div className="metric-card">
              <div className="metric-label">Total de Logins</div>
              <div className="metric-value">{users.length}</div>
              <div className="metric-subtext">Contas ativas no ERP</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Administradores</div>
              <div className="metric-value" style={{ color: 'var(--accent-indigo)' }}>{adminCount}</div>
              <div className="metric-subtext">Acesso total e gestão</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Operacionais</div>
              <div className="metric-value" style={{ color: 'var(--accent-emerald)' }}>{userCount}</div>
              <div className="metric-subtext">Operação das abas do ERP</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Users size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Logins Cadastrados
              </h3>
            </div>
            <div className="card-body">
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando logins...</div>
              ) : users.length === 0 ? (
                <div className="empty-state" style={{ padding: 40 }}>
                  <Users />
                  <div className="empty-state-title">Nenhum login listado</div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Clique em Novo Login para adicionar o primeiro usuário.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {users.map((u) => {
                    const isMaster = u.email === 'admin@solyd3d.com';
                    return (
                      <div
                        key={u.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '16px 0',
                          borderBottom: '1px solid var(--border-primary)',
                          flexWrap: 'wrap',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 10,
                              background: u.role === 'ADMIN' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: u.role === 'ADMIN' ? 'var(--accent-indigo)' : 'var(--accent-emerald)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {u.role === 'ADMIN' ? <Shield size={20} /> : <UserCheck size={20} />}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <strong style={{ fontSize: '0.95rem' }}>{u.name}</strong>
                              {isMaster && (
                                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4, background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B', fontWeight: 600 }}>
                                  MASTER
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <Mail size={12} /> {u.email}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => updateUserRole(u.id, u.role, u.email)}
                              disabled={isMaster}
                              style={{
                                border: 'none',
                                cursor: isMaster ? 'default' : 'pointer',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                padding: '6px 12px',
                                borderRadius: 6,
                                background: u.role === 'ADMIN' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                color: u.role === 'ADMIN' ? 'var(--accent-indigo)' : 'var(--accent-emerald)',
                              }}
                              title={isMaster ? 'Master' : 'Clique para alternar entre Administrador e Operacional'}
                            >
                              {u.role === 'ADMIN' ? 'Administrador' : 'Operacional'}
                            </button>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              Criado em {formatDate(u.createdAt)}
                            </div>
                          </div>

                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => deleteUser(u.id, u.email)}
                            disabled={isMaster}
                            title={isMaster ? 'Conta master não pode ser excluída' : 'Remover login'}
                            style={{ opacity: isMaster ? 0.3 : 1, cursor: isMaster ? 'not-allowed' : 'pointer' }}
                          >
                            <Trash2 size={16} color={isMaster ? 'var(--text-muted)' : '#F43F5E'} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <h3 className="card-title">
              <History size={16} style={{ marginRight: 8, verticalAlign: 'middle', color: 'var(--accent-indigo)' }} />
              Reconhecedor de Ações & Movimentações no ERP
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
              <select
                className="form-input"
                style={{ padding: '4px 10px', fontSize: '0.82rem', width: 'auto' }}
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
              >
                <option value="ALL">Todos os Módulos</option>
                <option value="ESTOQUE">📦 Estoque de Insumos</option>
                <option value="PRODUTOS">🛠️ Catálogo de Peças</option>
                <option value="PRODUCAO">🏭 Produção 3D</option>
                <option value="VENDAS">🏪 Comércios & Acertos</option>
                <option value="MAQUINAS">🖨️ Máquinas</option>
                <option value="USUARIOS">👥 Usuários</option>
              </select>
            </div>
          </div>
          <div className="card-body">
            {loadingLogs ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando histórico de auditoria...</div>
            ) : logs.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <Activity />
                <div className="empty-state-title">Nenhuma ação registrada</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>As adições, edições e exclusões no ERP aparecerão aqui automaticamente em tempo real.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {logs.map((item) => {
                  let badgeBg = 'rgba(99, 102, 241, 0.15)';
                  let badgeColor = 'var(--accent-indigo)';
                  if (item.actionType === 'CRIAR') { badgeBg = 'rgba(16, 185, 129, 0.15)'; badgeColor = 'var(--accent-emerald)'; }
                  if (item.actionType === 'EXCLUIR') { badgeBg = 'rgba(244, 63, 94, 0.15)'; badgeColor = '#F43F5E'; }
                  if (item.actionType === 'CONCLUIR') { badgeBg = 'rgba(59, 130, 246, 0.15)'; badgeColor = '#3B82F6'; }

                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        padding: '14px 0',
                        borderBottom: '1px solid var(--border-primary)',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, maxWidth: '75%' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: badgeBg,
                            color: badgeColor,
                            flexShrink: 0,
                            marginTop: 2,
                          }}
                        >
                          {item.actionType} ({item.module})
                        </span>
                        <div>
                          <div style={{ fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                            {item.description}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                            Por <strong>{item.userName}</strong> ({item.userEmail})
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {formatDate(item.createdAt)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Cadastrar Novo Login</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-rose" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertCircle size={16} />
                    <span style={{ fontSize: '0.85rem' }}>{error}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Nome Completo</label>
                  <input
                    className="form-input"
                    placeholder="Ex: Carlos Operador"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">E-mail de Acesso</label>
                  <input
                    className="form-input"
                    type="email"
                    placeholder="operador@solyd3d.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Senha Inicial</label>
                  <input
                    className="form-input"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Nível de Permissão</label>
                  <select
                    className="form-input"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="USER">Usuário Operacional — Acesso liberado a todas as abas (menos criar usuários)</option>
                    <option value="ADMIN">Administrador — Acesso total e gestão de acessos</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Cadastrando...' : 'Criar Login'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
