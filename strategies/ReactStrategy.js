import BaseStrategy from './BaseStrategy.js';
import fs from 'fs-extra';
import path from 'path';

export default class ReactStrategy extends BaseStrategy {
  async scaffoldSrc(targetDir, ctx) {
    const { projectName } = ctx;
    const srcDir = path.join(targetDir, "src");
    await fs.ensureDir(srcDir);
    await fs.writeFile(
      path.join(srcDir, "index.jsx"),
      `import React from 'react';\nimport { createRoot } from 'react-dom/client';\n\nconst App = () => <h1>Welcome to ${projectName} (React)</h1>;\n\nconst root = createRoot(document.getElementById('root'));\nroot.render(<App />);\n`
    );
    await fs.ensureDir(path.join(targetDir, "public"));
    await fs.writeFile(
      path.join(targetDir, "public", "index.html"),
      `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>${projectName}</title>\n</head>\n<body>\n  <div id="root"></div>\n</body>\n</html>\n`
    );
    const reactPkg = {
      name: projectName,
      version: "0.1.0",
      private: true,
      scripts: {
        start: "react-scripts start",
        build: "react-scripts build",
      },
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0",
        "react-scripts": "5.0.1",
      },
    };
    await fs.writeJSON(path.join(targetDir, "package.json"), reactPkg, {
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
