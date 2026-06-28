import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card } from '../components/Card';
import { startHostedAuth } from '../services/hostedAuth';

const LoginPage = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    startHostedAuth('login', searchParams.get('return_to'));
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Card title="Přesměrování do Alfares Auth">
          <div className="space-y-4 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
            <p className="text-gray-700">Otevíráme společný přihlašovací formulář Alfares...</p>
            <Link to="/" className="text-sm text-blue-600 hover:text-blue-500">
              Zpět na Allegro
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
