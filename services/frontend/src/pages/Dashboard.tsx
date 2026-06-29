/**
 * Dashboard Layout
 */

import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { Button } from '../components/Button';
import { AllegroAccountSelector } from '../components/AllegroAccountSelector';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [accountSelectionLoaded, setAccountSelectionLoaded] = React.useState(false);
  const [hasPublishReadyAccount, setHasPublishReadyAccount] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleAccountChange = React.useCallback((_accountId: string | null, activeAccountAuthorized: boolean) => {
    setAccountSelectionLoaded(true);
    setHasPublishReadyAccount(activeAccountAuthorized);
  }, []);

  const navigation = [
    { name: 'Products for Allegro', path: '/dashboard/products', icon: 'CP' },
    { name: 'Allegro drafts & offers', path: '/dashboard/offers', icon: 'AO' },
    { name: 'Orders', path: '/dashboard/orders', icon: 'OR' },
    { name: 'Import jobs', path: '/dashboard/import', icon: 'IJ' },
    { name: 'Operations', path: '/dashboard/operations', icon: 'OP' },
    { name: 'Settings & OAuth', path: '/dashboard/settings', icon: 'SO' },
    { name: 'Admin users', path: '/dashboard/admin/users', icon: 'AU' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-blue-700">Alfares CZ marketplace workspace</p>
              <h1 className="text-2xl font-bold text-gray-900">Allegro.alfares</h1>
              {user && (
                <p className="text-sm text-gray-600">
                  Signed in as {user.firstName || user.email}. Prepare catalog products for Allegro.alfares before any publish confirmation.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Můj účet</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <AllegroAccountSelector onAccountChange={handleAccountChange} />
                <Button variant="secondary" onClick={handleLogout}>
                  Odhlásit
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row">
        <aside className="bg-white shadow lg:min-h-screen lg:w-72">
          <nav className="p-4">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={`flex items-center rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className={`mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded border text-xs font-semibold ${isActive ? 'border-blue-200 bg-blue-500 text-white' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                        {item.icon}
                      </span>
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {accountSelectionLoaded && !hasPublishReadyAccount && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Publish confirmation path</p>
              <ol className="mt-2 list-decimal space-y-2 pl-4">
                <li>
                  Open{' '}
                  <Link to="/dashboard/settings" className="font-medium underline">
                    Settings & OAuth
                  </Link>{' '}
                  (<code className="break-all rounded bg-white/70 px-1 py-0.5 text-xs">/dashboard/settings</code>), then click{' '}
                  <span className="font-medium">Authorize OAuth</span> on the needed Allegro account. If the account shows{' '}
                  <span className="font-medium">Authorized</span> and <span className="font-medium">Revoke OAuth</span>, this step is already done.
                </li>
                <li>Select that authorized account in the <span className="font-medium">Můj účet</span> dropdown in the header.</li>
                <li>
                  Open{' '}
                  <Link to="/dashboard/products" className="font-medium underline">
                    Catalog products
                  </Link>{' '}
                  (<code className="break-all rounded bg-white/70 px-1 py-0.5 text-xs">/dashboard/products</code>), select a product, click{' '}
                  <span className="font-medium">Prepare draft</span>, review it, then click <span className="font-medium">Confirm publish</span>.
                </li>
              </ol>
              <p className="mt-2 text-xs">
                The Authorize OAuth button calls{' '}
                <code className="break-all rounded bg-white/70 px-1 py-0.5 text-xs">
                  {'/api/allegro/oauth/authorize?accountId=<account id>'}
                </code>{' '}
                with your signed-in session and then opens Allegro. Use the button, not a pasted raw API URL.
              </p>
            </div>
            )}
          </nav>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
