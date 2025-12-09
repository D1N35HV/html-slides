Landing Page Implementation Notes

Replace placeholders:
- Logo: Navbar SB badge — swap with your SVG/logo.
- Headline/subtext: Edit in `Hero.tsx`.
- CTA links: Point to your auth or signup endpoints.
- Feature copy/icons: Edit array in `Features.tsx`.
- 3D demo: Replace `Shape` in `Showcase3D.tsx` with your GLTF/GLB using drei's `<GLTF>`/`useGLTF`.
- Testimonials: Replace `items` in `Testimonials.tsx` with real quotes and avatars.

Assets:
- Avatars currently use pravatar.cc. Swap with local assets or your CDN.
- Colors use Tailwind `brand` palette defined in `tailwind.config.js`.

Accessibility & performance:
- Respect reduced motion by conditionally disabling animations: you can check `window.matchMedia('(prefers-reduced-motion)')` and pass reduced props to framer-motion.
- The three.js canvas is wrapped in Suspense and uses simple geometry/materials for performance. Keep polycount low and avoid heavy post-processing.

Routing:
- Public route available at `/landing`. The catch-all route also points to the landing page. Authenticated dashboard remains at `/`.
