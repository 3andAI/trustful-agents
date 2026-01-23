import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  LogOut,
  Shield,
  Menu,
  ExternalLink,
  Vote,
} from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { getPendingTransactions } from '../lib/api';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/pending', label: 'Pending Votes', icon: Vote, showBadge: true },
];

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Layout() {
  const { profile, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch pending count for badge
  const { data: pendingData } = useQuery({
    queryKey: ['pendingTransactions'],
    queryFn: getPendingTransactions,
    refetchInterval: 60000, // Check every minute
  });

  const pendingCount = pendingData?.transactions?.length ?? 0;

  return (
    <div className="min-h-screen flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-governance-900/95 backdrop-blur-sm border-r border-governance-800
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-governance-800">
            <a href="https://trustful-agents.ai" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-governance-100">Trustful</h1>
                <p className="text-xs text-governance-400">Governance</p>
              </div>
            </a>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path));
              const Icon = item.icon;
              const showBadge = item.showBadge && pendingCount > 0;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                    ${isActive
                      ? 'bg-accent/10 text-accent border border-accent/20'
                      : 'text-governance-400 hover:text-governance-100 hover:bg-governance-800/50'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                  {showBadge && (
                    <span className="ml-auto bg-accent text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {pendingCount}
                    </span>
                  )}
                </NavLink>
              );
            })}

            {/* Safe link */}
            <a
              href="https://app.safe.global"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-governance-400 hover:text-governance-100 hover:bg-governance-800/50"
            >
              <ExternalLink className="w-5 h-5" />
              <span className="font-medium">Open Safe</span>
            </a>
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-governance-800">
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-governance-800/50">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-governance-600 to-governance-700 flex items-center justify-center text-xs font-mono">
                {profile?.address?.slice(2, 4)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-governance-100 truncate">
                  {profile?.name || 'Signer'}
                </p>
                <p className="text-xs text-governance-500 font-mono">
                  {profile?.address && shortenAddress(profile.address)}
                </p>
              </div>
              <button
                onClick={logout}
                className="p-2 text-governance-400 hover:text-governance-100 hover:bg-governance-700 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-governance-950/95 backdrop-blur-sm border-b border-governance-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-governance-400 hover:text-governance-100 hover:bg-governance-800 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent" />
              <span className="font-semibold text-governance-100">Governance</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
