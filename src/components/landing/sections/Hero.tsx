import React from 'react';
import { HeroGeometric } from '@/components/ui/shape-landing-hero';

const Hero: React.FC = () => {
  return (
    <section className="relative overflow-hidden">
      <HeroGeometric badge="Slide Bolt" title1="Elevate Your" title2="Digital Vision" />
    </section>
  );
};

export default Hero;
