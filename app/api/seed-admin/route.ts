import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const ADMIN_EMAIL = 'admin@carettapool.test';
const ADMIN_PASSWORD = '123456';

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Missing Supabase env vars. Update .env.local before running this endpoint.' },
      { status: 500 }
    );
  }

  const authUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`;
  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    if (response.status === 409) {
      return NextResponse.json({
        message: 'Admin user already exists.',
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      });
    }

    return NextResponse.json({ error: data }, { status: response.status });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('profiles').upsert({
    id: data.id,
    role: 'admin',
    full_name: 'Admin',
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: 'Admin user created successfully.',
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
}
