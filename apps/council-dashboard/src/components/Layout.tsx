import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileCheck, 
  History, 
  LogOut,
  Wallet,
  AlertTriangle,
  Scale,
} from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { formatAddress } from '../lib/api';

export default function Layout() {
  const { address, isConnected, disconnect, isWrongNetwork, switchToBaseSepolia } = useWallet();
  const navigate = useNavigate();

  const handleDisconnect = () => {
    disconnect();
    navigate('/');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/claims', icon: FileCheck, label: 'All Claims' },
    { to: '/history', icon: History, label: 'My History' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-governance-900/50 border-r border-governance-800 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-governance-800">
          <a href="https://trustful-agents.ai" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-lg bg-council/20 flex items-center justify-center">
              <Scale className="w-6 h-6 text-council" />
            </div>
            <div>
              <h1 className="font-bold text-governance-100">Council</h1>
              <p className="text-xs text-governance-500">Trustful Agents</p>
            </div>
          </a>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-council/20 text-council'
                    : 'text-governance-400 hover:text-governance-100 hover:bg-governance-800/50'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Wrong Network Warning */}
        {isWrongNetwork && (
          <div className="mx-4 mb-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
            <div className="flex items-center gap-2 text-warning text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>Wrong Network</span>
            </div>
            <button
              onClick={switchToBaseSepolia}
              className="mt-2 w-full text-xs text-warning hover:text-warning-dark underline"
            >
              Switch Network
            </button>
          </div>
        )}

        {/* User Section */}
        <div className="p-4 border-t border-governance-800">
          {isConnected && address ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-governance-800/50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-council/20 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-council" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-governance-100 truncate">
                    {formatAddress(address)}
                  </p>
                  <p className="text-xs text-governance-500">Council Member</p>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-governance-400 hover:text-governance-100 hover:bg-governance-800/50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Disconnect</span>
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
