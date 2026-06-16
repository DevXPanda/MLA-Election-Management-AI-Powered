'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react';
import Modal from '../Modal';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { login } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message ? t(err.response.data.message, err.response.data.message) : t('login.failed', 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('login.title', 'Election Command Login')}
      subtitle={t('login.subtitle', 'Authorized access only for Election Management System')}
      maxWidth="max-w-[440px]"
    >
      <div className="py-4">
        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm mb-5 animate-slide-up">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-dark-400 dark:text-dark-500 uppercase tracking-wider mb-2">
              {t('label.email', 'Email Address')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input bg-white dark:bg-dark-800"
              placeholder="admin@missionftc.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-dark-400 dark:text-dark-500 uppercase tracking-wider mb-2">
              {t('label.password', 'Password')}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input bg-white dark:bg-dark-800 pr-12"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full h-12 text-base mt-2"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{t('login.authenticating', 'Signing in...')}</span>
              </div>
            ) : (
              t('action.sign_in', 'Sign In')
            )}
          </button>
        </form>
      </div>
    </Modal>
  );
}
