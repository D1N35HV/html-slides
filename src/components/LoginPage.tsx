import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import AuthLayout from './ui/AuthLayout';
import Input from './ui/Input';
import Button from './ui/Button';

export default function LoginPage() {
  const { login, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const success = await login(email, password);
    if (success) {
      toast.success('Logged in');
      navigate(from, { replace: true });
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue designing with SlideBolt"
      footer={
        <span>
          No account?{' '}
          <Link className="font-medium text-brand-700 hover:underline" to="/register">Create one</Link>
        </span>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="email"
          type="email"
          label="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          id="password"
          type="password"
          label="Password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="pt-2">
          <Button type="submit" loading={isLoading}>
            {isLoading ? 'Signing in…' : 'Login'}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
