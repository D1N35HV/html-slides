import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import AuthLayout from './ui/AuthLayout';
import Input from './ui/Input';
import Button from './ui/Button';

export default function RegisterPage() {
  const { register, isLoading, error, clearError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const success = await register(name, email, password);
    if (success) {
      toast.success('Account created');
      navigate('/', { replace: true });
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start building beautiful slides in minutes"
      footer={
        <span>
          Already have an account?{' '}
          <Link className="font-medium text-brand-700 hover:underline" to="/login">Sign in</Link>
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
          id="name"
          type="text"
          label="Full name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
          label="Password (min 6 chars)"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="pt-2">
          <Button type="submit" loading={isLoading}>
            {isLoading ? 'Creating…' : 'Create Account'}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
