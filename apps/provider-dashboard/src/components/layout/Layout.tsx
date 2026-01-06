import { Outlet, NavLink, useLocation, useParams } from 'react-router-dom'
import { LayoutDashboard, Bot, Shield, Menu, Plus, ExternalLink, Coins, FileText, AlertTriangle, Link2 } from 'lucide-react'
import { useState } from 'react'
import { WalletStatus } from '../wallet'
import { cn } from '../../lib/utils'

const mainNavItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/agents', label: 'My Agents', icon: Bot },
  { path: '/councils', label: 'Councils', icon: Shield },
]

export default function Layout() {
  const location = useLocation()
  const params = useParams()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const agentId = params.agentId
  const isAgentDetailView = location.pathname.startsWith('/agents/') && agentId && agentId !== 'new'

  const agentNavItems = agentId && agentId !== 'new' ? [
    { path: `/agents/${agentId}`, label: 'Overview', icon: LayoutDashboard, exact: true },
    { path: `/agents/${agentId}/collateral`, label: 'Collateral', icon: Coins },
    { path: `/agents/${agentId}/terms`, label: 'Terms & Conditions', icon: FileText },
    { path: `/agents/${agentId}/claims`, label: 'Claims', icon: AlertTriangle },
    { path: `/agents/${agentId}/integrate`, label: 'A2A Integration', icon: Link2 },
  ] : []

  return (
    <div className="min-h-screen flex">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-surface-900/95 backdrop-blur-sm border-r border-surface-800',
        'transform transition-transform duration-200 ease-in-out',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-surface-800">
            <NavLink to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-surface-100">Trustful</h1>
                <p className="text-xs text-surface-400">Provider Dashboard</p>
              </div>
            </NavLink>
          </div>

          {/* Main Navigation */}
          <nav className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-1">
              {mainNavItems.map((item) => {
                const Icon = item.icon
                const isActive = item.exact 
                  ? location.pathname === item.path
                  : location.pathname.startsWith(item.path)

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                      isActive
                        ? 'bg-accent/10 text-accent border border-accent/20'
                        : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/50'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </NavLink>
                )
              })}
            </div>

            {/* Agent Sub-Navigation */}
            {isAgentDetailView && (
              <div className="mt-6 pt-6 border-t border-surface-800">
                <p className="px-4 mb-2 text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Agent #{agentId}
                </p>
                <div className="space-y-1">
                  {agentNavItems.map((item) => {
                    const Icon = item.icon
                    const isActive = item.exact
                      ? location.pathname === item.path
                      : location.pathname === item.path

                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm',
                          isActive
                            ? 'bg-surface-800 text-surface-100'
                            : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/50'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="mt-6 pt-6 border-t border-surface-800">
              <NavLink
                to="/agents/new"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-surface-400 hover:text-surface-100 hover:bg-surface-800/50"
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium">New Agent</span>
              </NavLink>
              
              <a
                href="https://docs.trustful-agents.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-surface-400 hover:text-surface-100 hover:bg-surface-800/50"
              >
                <ExternalLink className="w-5 h-5" />
                <span className="font-medium">Documentation</span>
              </a>
            </div>
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-surface-800">
            <WalletStatus />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-surface-950/95 backdrop-blur-sm border-b border-surface-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-surface-400 hover:text-surface-100 hover:bg-surface-800 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-accent" />
              <span className="font-semibold text-surface-100">Provider Dashboard</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
