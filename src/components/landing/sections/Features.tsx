import React from 'react';
import { motion } from 'framer-motion';
import { RocketLaunchIcon, SparklesIcon, CubeTransparentIcon, CommandLineIcon, UsersIcon } from '@heroicons/react/24/outline';

const features = [
  {
    title: 'Precision layout',
    desc: 'Snap-to-grid, alignment guides, and smart spacing for pixel-perfect slides.',
    icon: <CommandLineIcon className="h-6 w-6" />,
    accent: 'from-brand-500 to-indigo-500'
  },
  {
    title: 'AI assisted',
    desc: 'Generate content and layouts, then refine with intuitive controls.',
    icon: <SparklesIcon className="h-6 w-6" />,
    accent: 'from-purple-500 to-pink-500'
  },
  {
    title: '3D ready',
    desc: 'Drag lightweight 3D models directly into slides for immersive demos.',
    icon: <CubeTransparentIcon className="h-6 w-6" />,
    accent: 'from-emerald-500 to-cyan-500'
  },
  {
    title: 'Realtime collab',
    desc: 'Work together with comments, cursors, and version history.',
    icon: <UsersIcon className="h-6 w-6" />,
    accent: 'from-orange-500 to-rose-500'
  },
  {
    title: 'Blazing fast',
    desc: 'Built with WebGL and virtualization for silky-smooth editing.',
    icon: <RocketLaunchIcon className="h-6 w-6" />,
    accent: 'from-sky-500 to-brand-500'
  },
];

const Features: React.FC = () => {
  return (
    <section id="features" className="relative">
      <div className="mx-auto max-w-7xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold">Everything you need to move ideas</h2>
          <p className="mt-3 text-gray-600">Minimal UI, maximal flow. Designed to disappear so your work shines.</p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
              className="group relative rounded-2xl border border-white/60 bg-white/60 backdrop-blur-xl p-6 shadow-soft hover:shadow-elevated transition-shadow"
            >
              <div className="h-12 w-12 rounded-xl bg-gradient-to-tr text-white flex items-center justify-center shadow-glow "
                   style={{ backgroundImage: `linear-gradient(to top right, var(--tw-gradient-from), var(--tw-gradient-to))` }}>
                <span className={`bg-gradient-to-tr ${f.accent} bg-clip-text text-transparent`}>{f.icon}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-gray-600">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
