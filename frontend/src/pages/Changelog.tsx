import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  GitCommitHorizontal,
  History,
  Moon,
  Sparkles,
  Sun,
  Tag,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { settingsApi } from '../services/api'
import { useAuthStore } from '../store/useAuthStore'
import { useThemeStore } from '../store/useThemeStore'
import { useSystemConfig } from '../hooks/useSystemConfig'
import { cx, digits, num } from '../utils/format'

/** Render simple inline **bold** and `code` tokens safely without HTML injection. */
function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-bold text-base-content">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          dir="ltr"
          className="inline-block rounded-md bg-base-200 px-1.5 py-0.5 font-mono text-[11px] text-primary mx-0.5"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    return <span key={idx}>{part}</span>
  })
}

export default function Changelog({ standalone = false }: { standalone?: boolean }) {
  const nav = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { theme, toggle } = useThemeStore()
  const { appVersion } = useSystemConfig()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['system-changelog'],
    queryFn: settingsApi.getChangelog,
    staleTime: 5 * 60 * 1000,
  })

  const releases = data?.releases ?? []
  const currentVersion = data?.current_version || appVersion
  const isPortalUser = Boolean(user?.is_customer_portal || user?.user_type === 'customer')

  const content = (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="تاریخچه نسخه‌ها و تغییرات سامانه"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-primary badge-soft font-bold px-3 py-3 text-xs gap-1.5">
              <Tag className="size-3.5" />
              نسخه فعلی: {digits(currentVersion)}
            </span>
            {standalone ? (
              <Link
                to={user ? (isPortalUser ? '/portal' : '/') : '/login'}
                className="btn btn-sm btn-ghost gap-1.5"
              >
                <ArrowRight className="size-4" />
                {user ? 'بازگشت به سامانه' : 'بازگشت به صفحه ورود'}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => nav(-1)}
                className="btn btn-sm btn-ghost gap-1.5"
              >
                <ArrowRight className="size-4" />
                بازگشت
              </button>
            )}
          </div>
        }
      />

      {isLoading ? (
        <div className="card-surface p-12 flex items-center justify-center gap-2.5 text-sm text-base-content/60">
          <span className="loading loading-spinner loading-md text-primary" />
          در حال بارگذاری تاریخچه نسخه‌ها...
        </div>
      ) : isError ? (
        <div className="card-surface p-8 text-center space-y-3">
          <p className="text-sm font-bold text-error">خطا در دریافت تاریخچه تغییرات سامانه</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="btn btn-sm btn-outline btn-error"
          >
            تلاش مجدد
          </button>
        </div>
      ) : releases.length === 0 ? (
        <div className="card-surface p-10 text-center space-y-2">
          <History className="size-8 mx-auto text-base-content/30" />
          <p className="text-sm font-bold text-base-content/75">هنوز نسخه‌ای در تاریخچه ثبت نشده است.</p>
        </div>
      ) : (
        <div className="relative space-y-6 before:absolute before:top-4 before:bottom-4 before:right-5 before:w-0.5 before:bg-gradient-to-b before:from-primary before:via-base-300 before:to-transparent">
          {releases.map((release, index) => {
            const isCurrent = release.is_current || index === 0
            return (
              <article key={release.version} className="relative pe-0 ps-0 pr-14">
                {/* Timeline node */}
                <span
                  className={cx(
                    'absolute right-2 top-5 flex size-7 items-center justify-center rounded-full border-2 shadow-xs',
                    isCurrent
                      ? 'border-primary bg-primary text-primary-content ring-4 ring-primary/15'
                      : 'border-base-300 bg-base-100 text-base-content/60',
                  )}
                  aria-hidden
                >
                  {isCurrent ? (
                    <Sparkles className="size-3.5" />
                  ) : (
                    <GitCommitHorizontal className="size-3.5" />
                  )}
                </span>

                {/* Release card */}
                <div
                  className={cx(
                    'card-surface overflow-hidden transition-all',
                    isCurrent && 'border-primary/40 shadow-sm',
                  )}
                >
                  {/* Release Header */}
                  <div
                    className={cx(
                      'flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b',
                      isCurrent
                        ? 'border-primary/20 bg-primary/5'
                        : 'border-base-200 bg-base-200/30',
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cx(
                          'badge font-mono font-extrabold text-xs px-3 py-3',
                          isCurrent ? 'badge-primary' : 'badge-neutral badge-soft',
                        )}
                      >
                        نسخه {digits(release.version)}
                      </span>
                      {isCurrent && (
                        <span className="badge badge-success badge-soft badge-xs font-bold py-2 px-2">
                          نسخه فعلی
                        </span>
                      )}
                      <span className="text-xs text-base-content/55">
                        ({num(release.sections.length)} بخش)
                      </span>
                    </div>

                    {release.jalali_date && (
                      <div className="inline-flex items-center gap-1.5 rounded-xl border border-base-300/70 bg-base-100 px-3 py-1.5 text-xs font-bold text-base-content/80">
                        <Calendar className="size-3.5 text-primary" />
                        <span>{digits(release.jalali_date)}</span>
                      </div>
                    )}
                  </div>

                  {/* Release Sections */}
                  <div className="p-5 space-y-5">
                    {release.sections.map((section, sIdx) => (
                      <div key={sIdx} className="space-y-2">
                        <h3 className="text-sm font-extrabold text-base-content flex items-center gap-2">
                          <span className="size-1.5 rounded-full bg-primary shrink-0" />
                          {section.title}
                        </h3>
                        <ul className="space-y-1.5 ps-4">
                          {section.items.map((item, iIdx) => (
                            <li
                              key={iIdx}
                              className="flex items-start gap-2 text-xs leading-6 text-base-content/75"
                            >
                              <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500 mt-1.5" />
                              <span className="flex-1 min-w-0">{renderInlineMarkdown(item)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )

  if (!standalone) {
    return content
  }

  return (
    <div className="min-h-dvh bg-base-200/70 text-base-content px-4 py-6 sm:px-6 sm:py-10">
      <div className="max-w-4xl mx-auto flex items-center justify-end mb-4">
        <button
          type="button"
          onClick={toggle}
          className="btn btn-ghost btn-sm btn-circle"
          aria-label="تغییر پوسته"
        >
          {theme === 'nikan-dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </div>
      {content}
    </div>
  )
}
