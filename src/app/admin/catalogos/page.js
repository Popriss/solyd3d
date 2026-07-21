'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Link as LinkIcon, Trash2, Edit, X, BookOpen, Package, Copy, Check } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

export default function CatalogosAdminPage() {
  const [catalogs, setCatalogs] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [copiedSlug, setCopiedSlug] = useState(null);

  const [form, setForm] = useState({
    name: '',
    productIds: [], // IDs dos produtos selecionados
  });

  const fetchCatalogs = useCallback(async () => {
    try {
      const res = await fetch('/api/catalogs');
      const data = await res.json();
      setCatalogs(Array.isArray(data) ? data : []);
    } catch { 
      setCatalogs([]); 
    } finally { 
      setLoading(false); 
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      // Mostraremos apenas produtos ativos ou todos. 
      // O endpoint retorna os produtos normais.
      setProducts(Array.isArray(data) ? data : []);
    } catch { 
      setProducts([]); 
    }
  }, []);

  useEffect(() => {
    fetchCatalogs();
    fetchProducts();
  }, [fetchCatalogs, fetchProducts]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      productIds: [],
    });
    setShowModal(true);
  };

  const openEdit = (cat) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      productIds: cat.items ? cat.items.map(item => item.productId) : [],
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const method = editing ? 'PUT' : 'POST';
    const body = editing ? { id: editing.id, ...form } : form;
    
    await fetch('/api/catalogs', { 
      method, 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(body) 
    });
    
    setShowModal(false);
    fetchCatalogs();
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este catálogo definitivamente? O link dele deixará de funcionar.')) return;
    await fetch(`/api/catalogs?id=${id}`, { method: 'DELETE' });
    fetchCatalogs();
  };

  const toggleProductSelection = (productId) => {
    setForm(prev => {
      if (prev.productIds.includes(productId)) {
        return { ...prev, productIds: prev.productIds.filter(id => id !== productId) };
      } else {
        return { ...prev, productIds: [...prev.productIds, productId] };
      }
    });
  };

  const handleCopyLink = (slug) => {
    const url = `${window.location.origin}/catalogo/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 2000);
    });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Catálogos de Produtos (PDF / Web)</h1>
          <p className="page-subtitle">Crie vitrines selecionadas para enviar aos clientes ou imprimir</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> Novo Catálogo
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nome do Catálogo</th>
              <th>Slug / Link</th>
              <th>Itens Inclusos</th>
              <th>Data de Criação</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: 40 }}>
                  <div className="spinner" style={{ margin: '0 auto' }}></div>
                </td>
              </tr>
            ) : catalogs.length === 0 ? (
              <tr>
                <td colSpan="5">
                  <div className="empty-state">
                    <BookOpen />
                    <div className="empty-state-title">Nenhum catálogo criado</div>
                  </div>
                </td>
              </tr>
            ) : catalogs.map(cat => {
              const itemsCount = cat.items ? cat.items.length : 0;
              return (
                <tr key={cat.id}>
                  <td>
                    <strong>{cat.name}</strong>
                  </td>
                  <td>
                    <span className="badge badge-slate" style={{ fontSize: 11, fontFamily: 'monospace' }}>
                      /catalogo/{cat.slug}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-purple" style={{ fontSize: 11 }}>
                      {itemsCount} {itemsCount === 1 ? 'Produto' : 'Produtos'}
                    </span>
                  </td>
                  <td>
                    {new Date(cat.createdAt).toLocaleDateString('pt-BR', { 
                      day: '2-digit', month: 'short', year: 'numeric' 
                    })}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="actions-row" style={{ justifyContent: 'flex-end' }}>
                      <button 
                        className="btn btn-ghost btn-sm" 
                        style={{ color: copiedSlug === cat.slug ? '#10b981' : '#3b82f6', display: 'flex', alignItems: 'center', gap: 6 }} 
                        onClick={() => handleCopyLink(cat.slug)} 
                        title="Copiar Link Público"
                      >
                        {copiedSlug === cat.slug ? <Check size={14} /> : <Copy size={14} />}
                        {copiedSlug === cat.slug ? 'Copiado!' : 'Copiar Link'}
                      </button>
                      
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => window.open(`/catalogo/${cat.slug}`, '_blank')} title="Ver Catálogo">
                        <LinkIcon size={14} />
                      </button>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(cat)} title="Editar">
                        <Edit size={14} />
                      </button>
                      <button className="btn btn-ghost btn-sm btn-icon" style={{ color: '#f87171' }} onClick={() => handleDelete(cat.id)} title="Remover">
                        <Trash2 size={14} />
                      </button>
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
              <h2 className="modal-title">{editing ? 'Editar Catálogo' : 'Novo Catálogo'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto', paddingRight: 6 }}>
                
                <h3 style={{ fontSize: 14, color: '#818cf8', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BookOpen size={16} /> Dados do Catálogo
                </h3>
                
                <div className="form-group">
                  <label className="form-label">Nome da Seleção</label>
                  <input 
                    className="form-input" 
                    placeholder="Ex: Catálogo Decoração Geek" 
                    value={form.name} 
                    onChange={e => setForm({ ...form, name: e.target.value })} 
                    required 
                  />
                  <small style={{ color: '#64748b', marginTop: 4, display: 'block' }}>
                    O link será gerado automaticamente a partir do nome.
                  </small>
                </div>

                <h3 style={{ fontSize: 14, color: '#34d399', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 6, margin: '20px 0 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Package size={16} /> Seleção de Produtos ({form.productIds.length} selecionados)
                </h3>
                
                <div style={{ 
                  background: 'rgba(255,255,255,0.02)', 
                  border: '1px solid rgba(255,255,255,0.05)', 
                  borderRadius: 8, 
                  maxHeight: 300, 
                  overflowY: 'auto',
                  padding: 10
                }}>
                  {products.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                      Nenhum produto cadastrado no sistema ainda.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
                      {products.map(product => {
                        const isSelected = form.productIds.includes(product.id);
                        return (
                          <div 
                            key={product.id}
                            onClick={() => toggleProductSelection(product.id)}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 12,
                              padding: '10px 14px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              background: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                              border: `1px solid ${isSelected ? 'rgba(16, 185, 129, 0.3)' : 'transparent'}`,
                              transition: 'all 0.15s ease'
                            }}
                            className="hover:bg-slate-800"
                          >
                            <div style={{
                              width: 18, height: 18, borderRadius: 4, 
                              border: `2px solid ${isSelected ? '#10b981' : '#475569'}`,
                              background: isSelected ? '#10b981' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              {isSelected && <Check size={12} color="white" strokeWidth={3} />}
                            </div>
                            
                            {/* Opcional: Thumbnail */}
                            {product.imageUrl && (
                              <div style={{ width: 32, height: 32, borderRadius: 4, overflow: 'hidden', background: '#334155' }}>
                                <img src={product.imageUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                            )}
                            
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 500, fontSize: 13, color: isSelected ? '#10b981' : '#e2e8f0' }}>
                                {product.name}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                {product.salePrice ? formatCurrency(product.salePrice) : 'Sob consulta'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  {editing ? 'Salvar Alterações' : 'Criar Catálogo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
