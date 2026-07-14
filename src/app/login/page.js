'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Printer, Lock, Mail, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError(res.error || 'Credenciais inválidas. Verifique seu e-mail e senha.');
      } else {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError('Erro ao tentar conectar. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      background: 'radial-gradient(circle at 50% 10%, rgba(99, 102, 241, 0.15), transparent 60%), var(--bg-primary)',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 32, border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: 'var(--accent-indigo)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)'
          }}>
            <Printer size={24} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 }}>Solyd3D ERP</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Acesso administrativo restrito</p>
        </div>

        {error && (
          <div className="alert alert-rose" style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12 }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: '0.85rem' }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={14} /> E-mail de Acesso
            </label>
            <input
              className="form-input"
              type="email"
              placeholder="admin@solyd3d.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 8 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lock size={14} /> Senha
            </label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: 12, justifyContent: 'center', fontWeight: 600, marginTop: 8 }}
            disabled={loading}
          >
            {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : <>Entrar no Sistema <ArrowRight size={16} /></>}
          </button>
        </form>

        <div style={{
          marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border-primary)',
          fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: 8
        }}>
          <ShieldCheck size={16} style={{ color: 'var(--accent-emerald)', flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>Primeiro Acesso?</strong> Se o banco estiver vazio, entre com <code>admin@solyd3d.com</code> e senha <code>Admin@123</code> para criar a contabilidade master.
          </div>
        </div>
      </div>
    </div>
  );
}
