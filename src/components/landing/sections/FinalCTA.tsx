import React from 'react';
import { motion } from 'framer-motion';

const FinalCTA: React.FC = () => {
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-4 py-24">
        <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/50 backdrop-blur-xl p-10 md:p-16 shadow-elevated">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative z-10 max-w-2xl"
          >
            <h3 className="text-3xl md:text-4xl font-bold">Make your next deck unforgettable.</h3>
            <p className="mt-3 text-gray-600">Start free. No credit card. Import your current slides in one click.</p>
            <div className="mt-8 flex items-center gap-3">
              <a href="/register" className="inline-flex items-center rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white px-6 py-3 font-medium shadow-elevated hover:shadow-glow transition-shadow">
                Get started
              </a>
              <a href="/login" className="inline-flex items-center rounded-xl px-6 py-3 font-medium border border-gray-200/80 bg-white/60 backdrop-blur-md hover:border-gray-300 text-gray-700">
                I already have an account
              </a>
            </div>
          </motion.div>
          <div aria-hidden className="pointer-events-none absolute -right-24 -bottom-24 h-64 w-64 rounded-full bg-gradient-to-tr from-brand-400/40 to-purple-400/40 blur-2xl" />
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
