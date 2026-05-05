import LoginForm from './LoginForm';

export const metadata = { title: 'Giriş — CarettaPool' };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string; error?: string };
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12">
      <div className="card w-full p-8">
        <h1 className="text-2xl font-bold text-slate-900">Giriş Yap</h1>
        <p className="mt-1 text-sm text-slate-600">
          Bayi veya admin hesabınızla giriş yapın.
        </p>
        {searchParams.error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Giriş başarısız oldu. Lütfen tekrar deneyin.
          </div>
        )}
        <LoginForm redirectTo={searchParams.redirect ?? '/create'} />
      </div>
    </div>
  );
}
