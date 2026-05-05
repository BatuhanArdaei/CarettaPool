'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import PhoneInput from '@/components/PhoneInput';

export default function ContactForm() {
  const supabase = createClient();
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    const { error } = await supabase.from('contact_requests').insert({
      name: form.name,
      email: form.email,
      phone: form.phone || null,
      message: form.message,
    });
    if (error) { setStatus('error'); return; }
    setStatus('sent');
    setForm({ name: '', email: '', phone: '', message: '' });
  }

  if (status === 'sent') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-green-50 p-10 ring-1 ring-green-200">
        <svg className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
        </svg>
        <p className="text-base font-semibold text-green-800">Mesajınız iletildi!</p>
        <p className="text-sm text-green-700">En kısa sürede size dönüş yapacağız.</p>
        <button onClick={() => setStatus('idle')} className="mt-2 text-sm text-green-600 underline">
          Yeni mesaj gönder
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl bg-slate-50 p-6 ring-1 ring-slate-200">
      <div>
        <label className="label" htmlFor="name">Adınız</label>
        <input id="name" className="input" value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
      </div>
      <div>
        <label className="label" htmlFor="email">E-posta</label>
        <input id="email" type="email" className="input" value={form.email}
          onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
      </div>
      <div>
        <label className="label" htmlFor="phone">Telefon</label>
        <PhoneInput
          id="phone"
          value={form.phone}
          onChange={v => setForm(p => ({ ...p, phone: v }))}
        />
      </div>
      <div>
        <label className="label" htmlFor="msg">Mesajınız</label>
        <textarea id="msg" rows={4} className="input" value={form.message}
          onChange={e => setForm(p => ({ ...p, message: e.target.value }))} />
      </div>
      {status === 'error' && (
        <p className="text-sm text-red-600">Mesaj gönderilemedi, lütfen tekrar deneyin.</p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={status === 'sending'}>
        {status === 'sending' ? 'Gönderiliyor…' : 'Gönder'}
      </button>
    </form>
  );
}
