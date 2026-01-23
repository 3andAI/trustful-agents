import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { X, CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react'
import { cn, getTxUrl } from '../lib/utils'

// =============================================================================
// Types
// =============================================================================

type ToastType = 'success' | 'error' | 'info' | 'loading'

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  txHash?: string
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  updateToast: (id: string, updates: Partial<Toast>) => void
}

// =============================================================================
// Context
// =============================================================================

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

// =============================================================================
// Provider
// =============================================================================

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { ...toast, id }])

    // Auto-remove non-loading toasts
    if (toast.type !== 'loading' && toast.duration !== 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, toast.duration || 5000)
    }

    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
    setToasts((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const updated = { ...t, ...updates }
        
        // If changed from loading to success/error, auto-remove after delay
        if (t.type === 'loading' && updates.type && updates.type !== 'loading') {
          setTimeout(() => {
            setToasts((current) => current.filter((toast) => toast.id !== id))
          }, updates.duration || 5000)
        }
        
        return updated
      })
    )
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, updateToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

// =============================================================================
// Toast Container
// =============================================================================

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

// =============================================================================
// Toast Item
// =============================================================================

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-success" />,
    error: <AlertCircle className="w-5 h-5 text-danger" />,
    info: <AlertCircle className="w-5 h-5 text-accent" />,
    loading: <Loader2 className="w-5 h-5 text-accent animate-spin" />,
  }

  const bgColors = {
    success: 'bg-success/10 border-success/30',
    error: 'bg-danger/10 border-danger/30',
    info: 'bg-accent/10 border-accent/30',
    loading: 'bg-surface-800 border-surface-700',
  }

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm animate-slide-in',
        bgColors[toast.type]
      )}
    >
      {icons[toast.type]}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-surface-100">{toast.title}</p>
        {toast.message && (
          <p className="text-sm text-surface-400 mt-0.5">{toast.message}</p>
        )}
        {toast.txHash && (
          <a
            href={getTxUrl(toast.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent hover:underline mt-1 inline-flex items-center gap-1"
          >
            View transaction <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      {toast.type !== 'loading' && (
        <button
          onClick={() => onRemove(toast.id)}
          className="text-surface-400 hover:text-surface-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

// =============================================================================
// Hook for Transaction Toasts
// =============================================================================

export function useTransactionToast() {
  const { addToast, updateToast, removeToast } = useToast()

  const showPending = useCallback((title: string = 'Transaction Pending') => {
    return addToast({
      type: 'loading',
      title,
      message: 'Please confirm in your wallet...',
    })
  }, [addToast])

  const showConfirming = useCallback((id: string, txHash: string) => {
    updateToast(id, {
      title: 'Confirming Transaction',
      message: 'Waiting for blockchain confirmation...',
      txHash,
    })
  }, [updateToast])

  const showSuccess = useCallback((id: string, title: string = 'Transaction Confirmed', txHash?: string) => {
    updateToast(id, {
      type: 'success',
      title,
      message: undefined,
      txHash,
    })
  }, [updateToast])

  const showError = useCallback((id: string, message: string = 'Transaction failed') => {
    updateToast(id, {
      type: 'error',
      title: 'Transaction Failed',
      message,
    })
  }, [updateToast])

  return { showPending, showConfirming, showSuccess, showError, removeToast }
}
