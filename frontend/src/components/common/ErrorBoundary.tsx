import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  errorMessage: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    errorMessage: '',
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'خطای غیرمنتظره‌ای در رابط کاربری رخ داد.',
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('CRM UI ErrorBoundary caught error:', error, info)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-screen flex items-center justify-center bg-base-200 p-6 font-sans text-base-content"
        >
          <div className="max-w-md w-full rounded-2xl border border-base-300 bg-base-100 p-6 shadow-lg text-center space-y-4">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-error/10 text-error">
              <AlertTriangle className="size-7" />
            </span>
            <h1 className="text-lg font-extrabold">بروز خطا در نمایش صفحه</h1>
            <p className="text-xs text-base-content/70 leading-relaxed">
              ممکن است نسخه جدیدی از سامانه روی سرور بارگذاری شده باشد یا ارتباط موقتاً قطع شده باشد. لطفاً صفحه را بازخوانی کنید.
            </p>
            {this.state.errorMessage && (
              <pre
                dir="ltr"
                className="rounded-xl bg-base-200 p-2.5 text-[11px] text-start overflow-x-auto text-base-content/60"
              >
                {this.state.errorMessage}
              </pre>
            )}
            <button onClick={this.handleReload} className="btn btn-primary w-full gap-2">
              <RotateCcw className="size-4" />
              بازخوانی مجدد سامانه
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
