import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local-dev only. On immediately.run the app is transpiled and run by the
// in-browser bundler; this config is for `npm run dev` / `build` off-platform.
export default defineConfig({
  plugins: [react()],
});
