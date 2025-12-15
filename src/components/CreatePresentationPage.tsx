import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiService from '../services/ApiService';
import { Toaster, toast } from 'react-hot-toast';
import Input from './ui/Input';
import Textarea from './ui/Textarea';
import Button from './ui/Button';
import { TagIcon, GlobeAltIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

const CreatePresentationPage: React.FC = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const tagArray = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      const res = await apiService.createPresentation({
        title: title.trim(),
        description: description.trim() || undefined,
        slides: [],
        isPublic,
        tags: tagArray
      } as any);
      if (res.success && res.data) {
        toast.success('Created! Redirecting...');
        // Mongo uses _id; adapt gracefully
        const id = (res as any).data._id || (res as any).data.id;
        if (id) {
          setTimeout(() => navigate(`/editor/${id}`), 600);
        } else {
          navigate('/');
        }
      } else {
        setError(res.message || 'Failed to create');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-surface-subtle to-surface-alt">
      {/* Header */}
      <header className="sticky top-0 z-20 h-16 backdrop-blur-xs bg-white/70 border-b border-white/40 flex items-center px-6">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="group inline-flex items-center gap-2 text-slate-600 hover:text-slate-900">
            <ArrowLeftIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
        </div>
        <div className="mx-auto">
          <h1 className="text-lg font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-brand-700 to-brand-500">Create Presentation</h1>
        </div>
        <div className="w-[88px]" />
      </header>

      {/* Main */}
      <main className="flex-1 px-4 py-8 md:px-6">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
          {/* Left: Form */}
          <section className="md:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl bg-white p-6 shadow-elevated ring-1 ring-black/5">
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

              <Input
                label="Title *"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Design Systems 101"
                required
              />

              <Textarea
                label="Description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief summary (optional)"
                rows={5}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input
                  label="Tags"
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="design, ui, ux"
                  leftIcon={<TagIcon className="h-5 w-5" />}
                  hint="Comma separated"
                />
                <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3">
                  <input
                    id="isPublic"
                    type="checkbox"
                    checked={isPublic}
                    onChange={e => setIsPublic(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <label htmlFor="isPublic" className="flex items-center gap-2 text-sm text-slate-700">
                    <GlobeAltIcon className="h-5 w-5 text-slate-500" /> Make public
                  </label>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <Button type="submit" loading={submitting} fullWidth={false} className="px-5">{submitting ? 'Creating...' : 'Create'}</Button>
                <Button type="button" variant="secondary" fullWidth={false} className="px-5" onClick={() => navigate('/')}>Cancel</Button>
              </div>
            </form>
          </section>

          {/* Right: Tips / Preview */}
          <aside className="md:col-span-1">
            <div className="rounded-2xl bg-white p-5 shadow-elevated ring-1 ring-black/5">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Tips</h3>
              <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                <li>Use a short, descriptive title.</li>
                <li>Add 2–5 tags to help organize.</li>
                <li>You can change visibility later.</li>
              </ul>
              <div className="mt-5 rounded-xl border border-gray-100 bg-surface-subtle p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Preview</p>
                <div className="aspect-video w-full rounded-lg bg-white shadow-soft grid place-items-center text-slate-400 text-sm">
                  New presentation
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  <span className="font-medium">URL</span>: <span className="select-all">/create → after save → /editor/&lt;id&gt;</span>
                </div>
              </div>
              <div className="mt-4 text-xs text-slate-500">
                By creating, you agree to our <Link to="#" className="text-brand-700 hover:underline">Terms</Link> and <Link to="#" className="text-brand-700 hover:underline">Privacy</Link>.
              </div>
            </div>
          </aside>
        </div>
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
};

export default CreatePresentationPage;
