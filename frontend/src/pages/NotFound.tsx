import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center">
      <span className="gradient-brand flex size-20 items-center justify-center rounded-3xl text-white shadow-xl shadow-primary/30">
        <Compass className="size-10" />
      </span>
      <h1 className="text-6xl font-black text-gradient">۴۰۴</h1>
      <p className="text-lg font-semibold">صفحه‌ای که دنبالش بودید پیدا نشد</p>
      <p className="max-w-sm text-sm text-base-content/60">ممکن است آدرس اشتباه باشد یا صفحه جابه‌جا شده باشد.</p>
      <Link to="/" className="btn btn-primary">بازگشت به داشبورد</Link>
    </div>
  )
}
