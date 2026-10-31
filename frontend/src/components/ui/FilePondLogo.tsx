import { useState } from 'react'
import { FilePond, registerPlugin } from 'react-filepond'
import FilePondPluginImagePreview from 'filepond-plugin-image-preview'
import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type'
import FilePondPluginFileValidateSize from 'filepond-plugin-file-validate-size'

// Import FilePond styles
import 'filepond/dist/filepond.min.css'
import 'filepond-plugin-image-preview/dist/filepond-plugin-image-preview.min.css'
import { Building2, X } from 'lucide-react'

// Register plugins safely
registerPlugin(FilePondPluginImagePreview, FilePondPluginFileValidateType, FilePondPluginFileValidateSize)

interface FilePondLogoProps {
  label?: string
  currentLogoUrl?: string | null
  onFileChange: (file: File | null) => void
  onRemoveCurrentLogo?: () => void
  disabled?: boolean
  className?: string
}

export function FilePondLogo({
  label = 'لوگوی شرکت یا سازمان',
  currentLogoUrl,
  onFileChange,
  onRemoveCurrentLogo,
  disabled = false,
  className = '',
}: FilePondLogoProps) {
  const [files, setFiles] = useState<any[]>([])

  return (
    <div className={`space-y-3 ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-base-content/80">
          {label}
        </label>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-5">
        {/* Current Logo Preview */}
        {currentLogoUrl && files.length === 0 ? (
          <div className="relative group shrink-0">
            <img
              src={currentLogoUrl}
              alt="لوگوی فعلی"
              className="size-20 rounded-2xl object-cover border-2 border-primary/20 shadow-md bg-base-100 p-1"
            />
            {onRemoveCurrentLogo && !disabled && (
              <button
                type="button"
                onClick={onRemoveCurrentLogo}
                className="absolute -top-2 -left-2 size-6 rounded-full bg-error text-error-content flex items-center justify-center shadow hover:opacity-90 transition-opacity cursor-pointer"
                title="حذف لوگوی فعلی"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ) : files.length === 0 ? (
          <div className="size-20 rounded-2xl bg-base-200 border border-base-300 flex items-center justify-center text-base-content/40 shrink-0">
            <Building2 className="size-8" />
          </div>
        ) : null}

        {/* FilePond Uploader */}
        <div className="flex-1 w-full max-w-sm filepond-custom-theme" style={{ fontFamily: 'var(--font-sans)' }}>
          <FilePond
            files={files}
            onupdatefiles={(fileItems) => {
              setFiles(fileItems)
              const first = fileItems[0]?.file as File | undefined
              onFileChange(first || null)
            }}
            allowMultiple={false}
            disabled={disabled}
            maxFileSize="2MB"
            acceptedFileTypes={['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']}
            labelIdle='<span class="filepond-vazir-label font-sans">فایل لوگو را بکشید یا <span class="filepond--label-action">انتخاب کنید</span></span>'
            labelFileProcessing="در حال بارگذاری..."
            labelFileProcessingComplete="بارگذاری انجام شد"
            labelTapToCancel="کلیک برای لغو"
            labelTapToRetry="کلیک برای تلاش مجدد"
            labelTapToUndo="کلیک برای حذف"
            labelButtonRemoveItem="حذف"
            labelMaxFileSizeExceeded="حجم فایل بیشتر از حد مجاز است"
            labelMaxFileSize="حداکثر حجم مجاز: {filesize}"
            labelFileTypeNotAllowed="فقط فرمت‌های PNG، JPG، SVG و WebP مجاز هستند"
            credits={false}
            imagePreviewHeight={120}
          />
          <p className="text-[11px] text-base-content/50 -mt-2">
            فرمت‌های مجاز: PNG, JPG, SVG, WebP (حداکثر ۲ مگابایت)
          </p>
        </div>
      </div>
    </div>
  )
}
