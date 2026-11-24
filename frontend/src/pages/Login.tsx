import { zodResolver } from "@hookform/resolvers/zod";
import {
  Clock,
  Cpu,
  Eye,
  EyeOff,
  Globe,
  Laptop,
  Lock,
  LogOut,
  MessageSquare,
  MonitorSmartphone,
  Moon,
  RotateCcw,
  ShieldAlert,
  Smartphone,
  Sun,
  Tablet,
  User,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Field } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { useSystemConfig } from "../hooks/useSystemConfig";
import { Logo } from "../layouts/Sidebar";
import { authApi } from "../services/api";
import { useAuthStore } from "../store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";
import type { SessionLimitChallenge } from "../types";
import { cx, dateFa, digits, num, relativeFa, toEnDigits } from "../utils/format";

const schema = z.object({
  login: z.string().min(3, "ایمیل یا شماره همراه را وارد کنید"),
  password: z.string().min(6, "گذرواژه حداقل ۶ کاراکتر است"),
});
type FormValues = z.infer<typeof schema>;

const features = [
  {
    icon: Cpu,
    title: "شناسه یکتای سریال و انبار هوشمند دستگاه‌ها",
    text: "تخصیص دستگاه‌ها به مشتریان با ثبت تعداد، مبلغ فاکتور، شماره سریال و کسر خودکار از موجودی انبار.",
  },
  {
    icon: Wrench,
    title: "سوابق سرویس دوره‌ای و تعمیرات",
    text: "پوشش گارانتی و پیگیری تاریخچه کامل خدمات و تعمیرات انجام‌شده برای هر دستگاه.",
  },
  {
    icon: MessageSquare,
    title: "سامانه پیامک خدماتی ملی‌پیامک",
    text: "ارسال پیامک با الگو و تحویل سریع به مشتریان حتی با خطوط مسدود تبلیغاتی.",
  },
];

function DeviceIcon({ platform }: { platform?: string }) {
  const p = (platform || "").toLowerCase();
  if (p.includes("iphone") || p.includes("android")) {
    return <Smartphone className="size-5" />;
  }
  if (p.includes("ipad")) {
    return <Tablet className="size-5" />;
  }
  if (p.includes("windows") || p.includes("mac") || p.includes("linux")) {
    return <Laptop className="size-5" />;
  }
  return <Globe className="size-5" />;
}

export default function Login() {
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const loginWithOtp = useAuthStore((s) => s.loginWithOtp);
  const resolveSessionLimit = useAuthStore((s) => s.resolveSessionLimit);
  const { theme, toggle } = useThemeStore();
  const { appVersion, isFeatureEnabled } = useSystemConfig();
  const nav = useNavigate();
  const location = useLocation();

  const otpEnabled = isFeatureEnabled("otp_login");

  const [authMode, setAuthMode] = useState<"password" | "otp">("password");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");

  // OTP state
  const [otpPhone, setOtpPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpStep, setOtpStep] = useState<"request" | "verify">("request");
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpLoading, setOtpLoading] = useState(false);

  // Max concurrent devices (3) modal state
  const [sessionChallenge, setSessionChallenge] =
    useState<SessionLimitChallenge | null>(null);
  const [resolvingTokenId, setResolvingTokenId] = useState<number | null>(null);
  const [challengeError, setChallengeError] = useState("");

  const effectiveAuthMode = otpEnabled ? authMode : "password";

  // Countdown timer for OTP
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { login: "", password: "" },
  });

  const isInitialized = useAuthStore((s) => s.isInitialized);
  const queryFrom = new URLSearchParams(location.search).get("from");
  const safeQueryFrom =
    queryFrom && queryFrom.startsWith("/") && !queryFrom.startsWith("//")
      ? queryFrom
      : null;
  const rawFrom =
    (location.state as { from?: string } | null)?.from ?? safeQueryFrom;

  const resolveDestination = (loggedUser: typeof user) => {
    const isPortal = Boolean(
      loggedUser?.is_customer_portal || loggedUser?.user_type === "customer",
    );
    if (isPortal) {
      return rawFrom && rawFrom.startsWith("/portal") ? rawFrom : "/portal";
    }
    return rawFrom && !rawFrom.startsWith("/portal") ? rawFrom : "/";
  };

  if (isInitialized && user) {
    return <Navigate to={resolveDestination(user)} replace />;
  }

  const onSubmit = async (v: FormValues) => {
    setError("");
    const res = await login(toEnDigits(v.login).trim(), toEnDigits(v.password));
    if (res.ok) {
      toast.success("خوش آمدید 👋");
      nav(resolveDestination(useAuthStore.getState().user), { replace: true });
    } else if (res.sessionLimit) {
      setChallengeError("");
      setSessionChallenge(res.sessionLimit);
    } else {
      setError(res.error);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const normalizedPhone = toEnDigits(otpPhone).trim();
    if (!/^09\d{9}$/.test(normalizedPhone)) {
      setError("شماره همراه باید ۱۱ رقم عددی بوده و با 09 شروع شود.");
      return;
    }
    setOtpLoading(true);
    try {
      const res = await authApi.sendOtp(normalizedPhone);
      toast.success(res.message);
      setOtpStep("verify");
      setOtpCooldown(res.expires_in || 120);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.errors?.phone?.[0] ||
          "خطا در ارسال کد پیامک",
      );
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const normalizedPhone = toEnDigits(otpPhone).trim();
    const normalizedCode = toEnDigits(otpCode).trim();
    if (normalizedCode.length < 5) {
      setError("لطفاً کد تایید ۵ رقمی را وارد کنید.");
      return;
    }
    setOtpLoading(true);
    try {
      const res = await loginWithOtp(normalizedPhone, normalizedCode);
      if (res.ok) {
        toast.success("ورود موفقیت‌آمیز بود 👋");
        nav(resolveDestination(useAuthStore.getState().user), { replace: true });
      } else if (res.sessionLimit) {
        setChallengeError("");
        setSessionChallenge(res.sessionLimit);
      } else {
        setError(res.error);
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleRevokeAndLogin = async (tokenId: number) => {
    if (!sessionChallenge) return;
    setChallengeError("");
    setResolvingTokenId(tokenId);
    try {
      const res = await resolveSessionLimit(
        sessionChallenge.challenge_token,
        tokenId,
      );
      if (res.ok) {
        setSessionChallenge(null);
        toast.success("دستگاه قبلی خارج شد و ورود شما انجام گردید 👋");
        nav(resolveDestination(useAuthStore.getState().user), { replace: true });
      } else if (res.sessionLimit) {
        setSessionChallenge(res.sessionLimit);
        setChallengeError(res.error);
      } else {
        setChallengeError(res.error);
      }
    } finally {
      setResolvingTokenId(null);
    }
  };

  const handleRevokeAllAndLogin = async () => {
    if (!sessionChallenge || sessionChallenge.sessions.length === 0) return;
    setChallengeError("");
    setResolvingTokenId(-1);
    try {
      const allIds = sessionChallenge.sessions.map((s) => s.id);
      const res = await resolveSessionLimit(
        sessionChallenge.challenge_token,
        allIds,
      );
      if (res.ok) {
        setSessionChallenge(null);
        toast.success("تمامی دستگاه‌های قبلی خارج شدند و ورود شما انجام گردید 👋");
        nav(resolveDestination(useAuthStore.getState().user), { replace: true });
      } else if (res.sessionLimit) {
        setSessionChallenge(res.sessionLimit);
        setChallengeError(res.error);
      } else {
        setChallengeError(res.error);
      }
    } finally {
      setResolvingTokenId(null);
    }
  };

  return (
    <div className="grid min-h-dvh bg-base-100 lg:grid-cols-2">
      {/* Form side */}
      <div className="relative flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-20">
        <button
          onClick={toggle}
          className="btn btn-ghost btn-circle absolute start-4 top-4"
          aria-label="تغییر پوسته"
        >
          {theme === "nikan-dark" ? (
            <Sun className="size-5" />
          ) : (
            <Moon className="size-5" />
          )}
        </button>

        <div className="mx-auto w-full max-w-md">
          <Logo size="lg" />
          <h1 className="mt-8 text-2xl font-black">ورود به سامانه CRM دستگاه‌ها</h1>
          <p className="mt-1.5 text-xs text-base-content/60">
            برای مدیریت مشتریان، کاتالوگ و انبار دستگاه‌ها و سامانه پیامک وارد شوید.
          </p>

          {/* Auth Method Switcher Tabs (only show switcher when OTP login is enabled) */}
          {otpEnabled && (
            <div role="tablist" className="tabs tabs-box w-full mt-6">
              <button
                type="button"
                role="tab"
                onClick={() => {
                  setAuthMode("password");
                  setError("");
                }}
                className={cx(
                  "tab flex-1 text-xs font-bold transition-all",
                  effectiveAuthMode === "password" && "tab-active",
                )}
              >
                <Lock className="size-3.5 inline-block me-1.5" />
                ورود با گذرواژه
              </button>
              <button
                type="button"
                role="tab"
                onClick={() => {
                  setAuthMode("otp");
                  setError("");
                }}
                className={cx(
                  "tab flex-1 text-xs font-bold transition-all",
                  effectiveAuthMode === "otp" && "tab-active",
                )}
              >
                <MessageSquare className="size-3.5 inline-block me-1.5" />
                ورود با پیامک (OTP)
              </button>
            </div>
          )}

          {/* Mode 1: Password Form */}
          {effectiveAuthMode === "password" && (
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="mt-5 space-y-4"
              noValidate
            >
              <Field
                label="نام کاربری (ایمیل یا شماره همراه)"
                error={errors.login?.message}
              >
                <label className="input input-bordered flex items-center gap-2 w-full">
                  <User className="size-4 text-base-content/40" />
                  <input
                    type="text"
                    dir="ltr"
                    className="grow text-start font-mono text-sm"
                    autoComplete="username"
                    placeholder="ایمیل یا شماره همراه خود را وارد کنید"
                    {...register("login", {
                      onChange: (e) => {
                        e.target.value = toEnDigits(e.target.value);
                      },
                    })}
                  />
                </label>
              </Field>

              <Field label="گذرواژه" error={errors.password?.message}>
                <label className="input input-bordered flex items-center gap-2 w-full">
                  <Lock className="size-4 text-base-content/40" />
                  <input
                    type={show ? "text" : "password"}
                    dir="ltr"
                    className="grow text-start font-mono text-sm"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    {...register("password", {
                      onChange: (e) => {
                        e.target.value = toEnDigits(e.target.value);
                      },
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="text-base-content/40 hover:text-base-content"
                  >
                    {show ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </label>
              </Field>

              {error && (
                <div className="rounded-xl border border-error/30 bg-error/10 p-3 text-xs text-error font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary w-full"
              >
                {isSubmitting && (
                  <span className="loading loading-spinner loading-xs" />
                )}
                ورود به سامانه
              </button>
            </form>
          )}

          {/* Mode 2: SMS OTP Form */}
          {effectiveAuthMode === "otp" && (
            <div className="mt-5 space-y-4">
              {otpStep === "request" ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <Field label="شماره تلفن همراه ثبت‌شده در سیستم">
                    <label className="input input-bordered flex items-center gap-2 w-full">
                      <Smartphone className="size-4 text-base-content/40" />
                      <input
                        type="tel"
                        dir="ltr"
                        maxLength={11}
                        className="grow text-start font-mono text-sm"
                        placeholder="09121234567"
                        value={otpPhone}
                        onChange={(e) =>
                          setOtpPhone(
                            toEnDigits(e.target.value).replace(/\D/g, "").slice(0, 11),
                          )
                        }
                        required
                        autoFocus
                      />
                    </label>
                  </Field>

                  {error && (
                    <div className="rounded-xl border border-error/30 bg-error/10 p-3 text-xs text-error font-medium">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={otpLoading || otpPhone.length !== 11}
                    className="btn btn-primary w-full gap-2"
                  >
                    {otpLoading ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <MessageSquare className="size-4" />
                    )}
                    دریافت کد ورود با پیامک
                  </button>

                  <p className="text-[11px] text-base-content/60 leading-relaxed text-center">
                    کد یکبار مصرف ۵ رقمی از طریق پیامک به شماره همراه شما ارسال
                    خواهد شد.
                  </p>
                </form>
              ) : (
                <form
                  onSubmit={handleVerifyOtp}
                  className="space-y-4 animate-in fade-in duration-200"
                >
                  <div className="flex items-center justify-between bg-base-200 p-2.5 rounded-xl text-xs">
                    <span className="text-base-content/70">
                      ارسال‌شده به:{" "}
                      <span className="font-mono font-bold text-base-content">
                        {digits(otpPhone)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpStep("request");
                        setOtpCode("");
                        setError("");
                      }}
                      className="text-primary text-[11px] font-bold hover:underline"
                    >
                      تغییر شماره
                    </button>
                  </div>

                  <Field label="کد تأیید ۵ رقمی پیامک‌شده">
                    <input
                      type="text"
                      dir="ltr"
                      maxLength={5}
                      className="input input-bordered w-full text-center font-mono text-lg tracking-widest font-bold"
                      placeholder="• • • • •"
                      value={otpCode}
                      onChange={(e) =>
                        setOtpCode(
                          toEnDigits(e.target.value).replace(/\D/g, "").slice(0, 5),
                        )
                      }
                      required
                      autoFocus
                    />
                  </Field>

                  {error && (
                    <div className="rounded-xl border border-error/30 bg-error/10 p-3 text-xs text-error font-medium">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={otpLoading || otpCode.length !== 5}
                    className="btn btn-primary w-full"
                  >
                    {otpLoading && (
                      <span className="loading loading-spinner loading-xs" />
                    )}
                    تأیید و ورود به سامانه
                  </button>

                  {/* Resend Timer / Button */}
                  <div className="text-center pt-1 text-xs">
                    {otpCooldown > 0 ? (
                      <span className="text-base-content/50">
                        امکان ارسال مجدد کد پس از{" "}
                        <span className="font-mono font-bold text-primary">
                          {digits(String(otpCooldown))}
                        </span>{" "}
                        ثانیه
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        className="btn btn-ghost btn-xs text-primary font-bold gap-1"
                      >
                        <RotateCcw className="size-3" />
                        ارسال مجدد کد پیامک
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Decorative / Features side */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-tr from-slate-900 via-indigo-950 to-blue-950 p-12 text-white lg:flex">
        <div className="space-y-3">
          <Link
            to="/changelog"
            className="badge badge-primary font-mono text-xs hover:opacity-85 transition-opacity"
            title="مشاهده تاریخچه نسخه‌ها و تغییرات سامانه"
          >
            نسخه {digits(appVersion)}
          </Link>
          <h2 className="text-3xl font-black leading-tight">
            سامانه تخصصی مدیریت دستگاه‌ها، انبار، سوابق سرویس و ارتباط با مشتریان
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed max-w-lg">
            پوشش کامل چرخه از سرنخ بالقوه تا تحویل دستگاه، مدیریت موجودی انبار،
            ثبت سوابق گارانتی و ارسال پیامک با وب‌سرویس ملی‌پیامک.
          </p>
        </div>

        <div className="space-y-4">
          {features.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="flex items-start gap-4 rounded-2xl bg-white/5 p-4 backdrop-blur-sm border border-white/10"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
                <Icon className="size-5" />
              </span>
              <div>
                <p className="font-bold text-sm text-white">{title}</p>
                <p className="mt-0.5 text-xs text-slate-300">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Concurrent Device Limit Reached (Max 3 Devices) */}
      <Modal
        open={Boolean(sessionChallenge)}
        onClose={() => {
          if (resolvingTokenId === null) {
            setSessionChallenge(null);
            setChallengeError("");
          }
        }}
        size="lg"
        title={`محدودیت دستگاه‌های هم‌زمان (حداکثر ${num(sessionChallenge?.max_sessions ?? 3)} دستگاه)`}
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            {(sessionChallenge?.sessions.length ?? 0) > 1 ? (
              <button
                type="button"
                className="btn btn-sm btn-error btn-outline gap-1.5"
                disabled={resolvingTokenId !== null}
                onClick={handleRevokeAllAndLogin}
              >
                {resolvingTokenId === -1 ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <LogOut className="size-3.5" />
                )}
                خروج از همه دستگاه‌های قبلی و ورود
              </button>
            ) : (
              <span />
            )}

            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={resolvingTokenId !== null}
              onClick={() => {
                setSessionChallenge(null);
                setChallengeError("");
              }}
            >
              انصراف
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-warning/35 bg-warning/10 p-3.5 text-xs text-warning-content">
            <ShieldAlert className="size-5 shrink-0 text-warning mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-base-content">
                سقف مجاز ورود هم‌زمان تکمیل شده است
              </p>
              <p className="text-base-content/75 leading-relaxed">
                {sessionChallenge?.message ||
                  "هر کاربر می‌تواند هم‌زمان حداکثر در ۳ دستگاه وارد شود. برای ادامه ورود روی این دستگاه، یکی از نشست‌های فعال زیر را خارج کنید."}
              </p>
            </div>
          </div>

          {challengeError && (
            <div className="rounded-xl border border-error/30 bg-error/10 p-3 text-xs text-error font-medium">
              {challengeError}
            </div>
          )}

          <div className="space-y-2.5">
            {(sessionChallenge?.sessions ?? []).map((session) => {
              const isBusy = resolvingTokenId === session.id;
              return (
                <div
                  key={session.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-base-200 bg-base-100 p-3.5 hover:border-base-300 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-base-200 text-base-content/70">
                      <DeviceIcon platform={session.platform} />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <p className="font-bold text-xs sm:text-sm text-base-content truncate flex items-center gap-1.5">
                        <MonitorSmartphone className="size-3.5 text-primary shrink-0" />
                        {session.device_name}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-base-content/60">
                        {session.ip_address && (
                          <span className="font-mono ltr-text">
                            IP: {digits(session.ip_address)}
                          </span>
                        )}
                        {session.created_at && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" />
                            ورود: {dateFa(session.created_at)}
                          </span>
                        )}
                        {session.last_used_at && (
                          <span>آخرین فعالیت: {relativeFa(session.last_used_at)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={resolvingTokenId !== null}
                    onClick={() => handleRevokeAndLogin(session.id)}
                    className="btn btn-xs sm:btn-sm btn-error btn-soft gap-1.5 shrink-0"
                  >
                    {isBusy ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <LogOut className="size-3.5" />
                    )}
                    خروج از این دستگاه و ورود
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
}
