import { Link, useLocation } from 'react-router-dom'
import { useAccount, useDisconnect } from 'wagmi'
import { 
  LayoutDashboard, 
  FilePlus, 
  FileText, 
  Search,
  LogOut,
  Wallet
} from 'lucide-react'
import { formatAddress } from '../lib/api'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'File Claim', href: '/file', icon: FilePlus },
  { name: 'Lookup Agent', href: '/agent/search', icon: Search },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { address, chain } = useAccount()
  const { disconnect } = useDisconnect()

  const isWrongNetwork = chain?.id !== 84532

  return (
    <div className="min-h-screen bg-surface-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-surface-800 border-r border-surface-700 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-surface-700">
          <a href="https://trustful-agents.ai" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-claimer to-claimer-dark flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-surface-100">Trustful</h1>
              <p className="text-xs text-surface-400">Claimer Portal</p>
            </div>
          </a>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== '/' && location.pathname.startsWith(item.href))
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-claimer/10 text-claimer'
                    : 'text-surface-400 hover:text-surface-100 hover:bg-surface-700/50'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* Wallet Info */}
        <div className="p-4 border-t border-surface-700">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isWrongNetwork ? 'bg-danger/20' : 'bg-claimer/20'
            }`}>
              <Wallet className={`w-4 h-4 ${
                isWrongNetwork ? 'text-danger' : 'text-claimer'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${
                isWrongNetwork ? 'text-danger' : 'text-surface-100'
              }`}>
                {isWrongNetwork ? 'Wrong Network' : 'Connected'}
              </p>
              <p className="text-xs text-surface-500 truncate">
                {address && formatAddress(address)}
              </p>
            </div>
            <button
              onClick={() => disconnect()}
              className="p-2 text-surface-400 hover:text-surface-100 hover:bg-surface-700 rounded-lg transition-colors"
              title="Disconnect"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          {isWrongNetwork && (
            <p className="text-xs text-danger">
              Please switch to Base Sepolia
            </p>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
