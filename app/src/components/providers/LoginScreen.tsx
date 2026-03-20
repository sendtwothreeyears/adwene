import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Eye, EyeOff, Lock } from "lucide-react";

interface LoginScreenProps {
  providerName: string;
  providerInitials: string;
  passwordHash: string;
  onLogin: () => void;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

export default function LoginScreen({
  providerName,
  providerInitials,
  passwordHash,
  onLogin,
}: LoginScreenProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  // Countdown timer
  useEffect(() => {
    if (!lockedUntil) return;

    const tick = () => {
      const remaining = Math.max(0, lockedUntil - Date.now());
      setRemainingSeconds(Math.ceil(remaining / 1000));
      if (remaining <= 0) {
        setLockedUntil(null);
        setFailedAttempts(0);
        setError(null);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLocked || !password || checking) return;

    setError(null);
    setChecking(true);

    try {
      const valid = await invoke<boolean>("verify_password", {
        password,
        hash: passwordHash,
      });

      if (valid) {
        onLogin();
      } else {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        setPassword("");
        triggerShake();

        if (newAttempts >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCKOUT_MS);
          setError("Too many attempts. Account locked.");
        } else {
          setError(
            `Incorrect password. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts === 1 ? "" : "s"} remaining.`
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100/80 backdrop-blur-sm">
      <div className="flex w-full max-w-sm flex-col items-center">
        {/* Avatar */}
        <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-primary text-3xl font-bold text-white shadow-lg">
          {providerInitials}
        </div>

        {/* Name */}
        <h2 className="mb-6 font-ddn text-xl font-semibold text-gray-800">
          {providerName}
        </h2>

        {/* Password form */}
        <form
          onSubmit={handleSubmit}
          className={`w-full transition-transform ${shake ? "animate-shake" : ""}`}
        >
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLocked}
              placeholder={isLocked ? "Locked" : "Enter password"}
              className="w-full rounded-xl border border-gray-300 bg-white/90 px-4 py-3 pr-20 text-center text-sm shadow-sm backdrop-blur-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              autoFocus
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="rounded p-1 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
              <button
                type="submit"
                disabled={!password || checking || isLocked}
                className="rounded p-1 text-gray-400 hover:text-primary disabled:opacity-30"
                tabIndex={-1}
              >
                <Lock className="h-4 w-4" />
              </button>
            </div>
          </div>
        </form>

        {/* Error / lockout message */}
        {error && (
          <p className="mt-3 text-center text-sm text-red-600">{error}</p>
        )}
        {isLocked && (
          <p className="mt-1 text-center text-sm text-gray-500">
            Try again in {formatTime(remainingSeconds)}
          </p>
        )}
      </div>
    </div>
  );
}
