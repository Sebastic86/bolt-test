import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, Eye, EyeOff } from 'lucide-react';

interface LoginFormProps {
  onSuccess?: () => void;
}

function loginErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  if (message.includes('Invalid login credentials')) {
    return 'Invalid email or password. Please try again.';
  }
  if (message.includes('Email not confirmed')) {
    return 'Please check your email and confirm your account before signing in.';
  }
  if (message.includes('Too many requests')) {
    return 'Too many login attempts. Please wait a moment and try again.';
  }
  return 'An error occurred during sign in. Please try again.';
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const { signIn, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!password.trim()) {
      setError('Password is required');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    try {
      await signIn(email.trim(), password);
      onSuccess?.();
    } catch (err) {
      console.error('Login error:', err);
      setError(loginErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const busy = isSubmitting || isLoading;

  return (
    <div className="flex min-h-0 flex-1 items-center-safe justify-center overflow-y-auto bg-[#fafafa] p-4">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center border-2 border-(--color-ink) bg-white">
            <LogIn className="h-6 w-6 text-(--color-ink)" />
          </div>
          <h1 className="mt-6 text-xl font-black uppercase tracking-wide text-(--color-ink)">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-gray-600">Access EA FC Generator</p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wide text-(--color-ink)">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block h-11 w-full border-2 border-(--color-ink) px-3 text-sm placeholder-gray-400 focus:outline-none"
              placeholder="you@example.com"
              disabled={busy}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wide text-(--color-ink)">
              Password
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block h-11 w-full border-2 border-(--color-ink) px-3 pr-10 text-sm placeholder-gray-400 focus:outline-none"
                placeholder="••••••••"
                disabled={busy}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3"
                onClick={() => setShowPassword(!showPassword)}
                disabled={busy}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400 hover:text-(--color-ink)" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400 hover:text-(--color-ink)" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="border border-red-300 bg-red-50 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex h-11 w-full items-center justify-center gap-2 border-2 border-(--color-ink) bg-(--color-ink) text-sm font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Sign in
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-500">
          Contact your administrator if you need an account
        </p>
      </div>
    </div>
  );
};

export default LoginForm;
