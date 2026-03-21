import BaseStrategy from './BaseStrategy.js';
import fs from 'fs-extra';
import path from 'path';

export default class NextjsStrategy extends BaseStrategy {
  async scaffoldSrc(targetDir, ctx) {
    const { projectName } = ctx;
    const srcDir = path.join(targetDir, "src");
    await fs.ensureDir(path.join(srcDir, "app"));
    await fs.writeFile(
      path.join(srcDir, "app", "page.tsx"),
      `export default function Home() {\n  return <h1>Welcome to ${projectName} (Next.js)</h1>;\n}\n`
    );
    const nextPkg = {
      name: projectName,
      version: "0.1.0",
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
    await fs.writeJSON(path.join(targetDir, "package.json"), nextPkg, {
      spaces: 2,
    });
  }

  async scaffoldEnvironment(targetDir, ctx) {
    const { projectName, environment } = ctx;

    if (environment === "docker") {
      const dockerComposeContent = `
services:
  app:
    image: node:18-alpine
    working_dir: /app
    volumes:
      - .:/app
    ports:
      - "3000:3000"
    command: npm run dev
`;
      await fs.writeFile(
        path.join(targetDir, "docker-compose.yaml"),
        dockerComposeContent
      );
    } else if (environment === "lando") {
      const landoContent = `name: ${projectName}
recipe: node
config:
  node: '18'
  command: npm run dev
`;
      await fs.writeFile(path.join(targetDir, ".lando.yml"), landoContent);
    }
  }
}
