import BaseStrategy from './BaseStrategy.js';
import fs from 'fs-extra';
import path from 'path';
import EnvironmentFactory from '../services/EnvironmentFactory.js';
import GitService from '../services/GitService.js';

export default class NextjsStrategy extends BaseStrategy {
  async scaffoldSrc(targetDir, ctx) {
    const { projectName } = ctx;
    const srcDir = path.join(targetDir, "src");
    
    await fs.ensureDir(path.join(srcDir, "app"));
    await fs.ensureDir(path.join(srcDir, "components"));
    await fs.ensureDir(path.join(srcDir, "lib"));
    
    await fs.writeFile(
      path.join(srcDir, "app", "layout.tsx"),
      `export default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (<html lang="en"><body>{children}</body></html>);\n}\n`
    );

    await fs.writeFile(
      path.join(srcDir, "app", "page.tsx"),
      `export default function Home() {\n  return <h1>Welcome to ${projectName} (Next.js App Router)</h1>;\n}\n`
    );

    const apiUrl = ctx.useLaravel ? "http://localhost:8000/api" : "https://api.example.com";
    await fs.writeFile(
      path.join(srcDir, "lib", "api.ts"),
      `export const API_URL = process.env.NEXT_PUBLIC_API_URL || "${apiUrl}";\n`
    );

    await fs.writeFile(
      path.join(targetDir, "next.config.js"),
      `/** @type {import('next').NextConfig} */\nconst nextConfig = {};\nexport default nextConfig;\n`
    );

    const nextPkg = {
      name: projectName,
      version: "0.1.0",
      type: "module",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
      },
      dependencies: {
        next: "latest",
        react: "latest",
        "react-dom": "latest",
      },
    };
    await fs.writeJSON(path.join(targetDir, "package.json"), nextPkg, { spaces: 2 });

    await GitService.scaffoldGitignore(targetDir, "nextjs");
  }

  async scaffoldEnvironment(targetDir, ctx) {
    const envService = EnvironmentFactory.getService(ctx.environment);
    await envService.scaffold(targetDir, "nextjs", ctx);
  }
}
