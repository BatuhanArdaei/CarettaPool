'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Prevent open redirect — only allow same-origin paths
      const safePath = redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/create';
      router.push(safePath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız. E-posta veya şifrenizi kontrol edin.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label className="label" htmlFor="email">E-posta</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          required
          autoComplete="email"
        />
      </div>
      <div>
        <label className="label" htmlFor="password">Şifre</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
          minLength={6}
          required
          autoComplete="current-password"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
      </button>

      <p className="text-center text-xs text-slate-400">
        Hesabınız yoksa yöneticinizle iletişime geçin.
      </p>
    </form>
  );
}
