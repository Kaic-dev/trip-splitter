import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

const getGitHash = () => {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: 'pipe' }).toString().trim();
  } catch (err) {
    // Check environment variables for common CI providers (GitHub Actions, Vercel)
    return (
      process.env.GITHUB_SHA?.slice(0, 7) || 
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 
      'no-git'
    );
  }
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_BUILD__: JSON.stringify(getGitHash())
  }
})
