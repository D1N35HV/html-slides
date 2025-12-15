import React, { useEffect } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { motion } from 'framer-motion';

const items = [
  { name: 'Ava Martinez', role: 'Product Designer', quote: 'Slide Bolt has cut our deck creation time by 70%. The editor feels invisible.', img: 'https://i.pravatar.cc/96?img=32' },
  { name: 'Liam Chen', role: 'Founder', quote: 'The 3D embeds wow investors every time. It just works.', img: 'https://i.pravatar.cc/96?img=15' },
  { name: 'Noah Johnson', role: 'PM', quote: 'Realtime collaboration is seamless—comments and cursors are buttery smooth.', img: 'https://i.pravatar.cc/96?img=5' },
  { name: 'Sophia Lee', role: 'Engineer', quote: 'I love the minimalist UI and precise alignment tools. It feels pro.', img: 'https://i.pravatar.cc/96?img=47' },
];

const Testimonials: React.FC = () => {
  const [emblaRef, embla] = useEmblaCarousel({ loop: true, align: 'start', dragFree: true });

  useEffect(() => {
    const interval = setInterval(() => embla?.scrollNext(), 4000);
    return () => clearInterval(interval);
  }, [embla]);

  return (
    <section id="testimonials" className="relative">
      <div className="mx-auto max-w-7xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h3 className="text-3xl font-bold">Loved by modern teams</h3>
          <p className="mt-3 text-gray-600">Hear how creators move faster with Slide Bolt.</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="mt-10 overflow-hidden" ref={emblaRef as any}
        >
          <div className="flex gap-6">
            {items.map((t, i) => (
              <div key={i} className="min-w-[300px] sm:min-w-[360px] rounded-2xl border border-white/60 bg-white/60 backdrop-blur-xl p-6 shadow-soft">
                <div className="flex items-center gap-3">
                  <img src={t.img} alt={t.name} className="h-10 w-10 rounded-full ring-2 ring-white" />
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-sm text-gray-600">{t.role}</div>
                  </div>
                </div>
                <p className="mt-4 text-gray-700">“{t.quote}”</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Testimonials;
