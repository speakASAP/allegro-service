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

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navigation = [
    { name: 'Catalog products', path: '/dashboard/products', icon: 'CP' },
    { name: 'Allegro drafts & offers', path: '/dashboard/offers', icon: 'AO' },
    { name: 'Orders', path: '/dashboard/orders', icon: 'OR' },
    { name: 'Import jobs', path: '/dashboard/import', icon: 'IJ' },
    { name: 'Settings & OAuth', path: '/dashboard/settings', icon: 'SO' },
    { name: 'Admin users', path: '/dashboard/admin/users', icon: 'AU' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-blue-700">Registered seller workspace</p>
              <h1 className="text-2xl font-bold text-gray-900">Allegro Client Dashboard</h1>
              {user && (
                <p className="text-sm text-gray-600">
                  Signed in as {user.firstName || user.email}. Prepare catalog products as local drafts before any publish confirmation.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <AllegroAccountSelector />
              <Button variant="secondary" onClick={handleLogout}>
                Logout
              </Button>
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
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Publish confirmation is gated.</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>Authorize an Allegro account in Settings & OAuth.</li>
                <li>Select that authorized account in the header.</li>
                <li>Return here, prepare the draft, then confirm publish.</li>
              </ol>
              <p className="mt-2 text-xs">If OAuth client credentials are missing or expired, ops may store the renewed keys in Kubernetes Vault before retrying authorization.</p>
            </div>
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
