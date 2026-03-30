import BaseStrategy from './BaseStrategy.js';
import fs from 'fs-extra';
import path from 'path';
import { scaffoldGitignore } from '../utils/git.js';

export default class ReactStrategy extends BaseStrategy {
  async scaffoldSrc(targetDir, ctx) {
    const { projectName } = ctx;
    const srcDir = path.join(targetDir, "src");
    
    await fs.ensureDir(path.join(srcDir, "assets"));
    await fs.ensureDir(path.join(srcDir, "components"));
    await fs.ensureDir(path.join(srcDir, "pages"));
    await fs.ensureDir(path.join(srcDir, "hooks"));
    
    const servicesDir = path.join(srcDir, "services");
    await fs.ensureDir(servicesDir);
    const apiUrl = ctx.useLaravel ? "http://localhost:8000/api" : "https://api.example.com";
    await fs.writeFile(
      path.join(servicesDir, "api.js"),
      `export const API_URL = import.meta.env.VITE_API_URL || "${apiUrl}";\n\nexport const fetchExample = async () => {\n  const response = await fetch(API_URL + '/user');\n  return response.json();\n};\n`
    );

    await fs.writeFile(
      path.join(srcDir, "App.jsx"),
      `import React from 'react';\n\nexport default function App() {\n  return <h1>Welcome to ${projectName} (Vite + React)</h1>;\n}\n`
    );

    await fs.writeFile(
      path.join(srcDir, "main.jsx"),
      `import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\n\nconst root = createRoot(document.getElementById('root'));\nroot.render(<App />);\n`
    );

    await fs.ensureDir(path.join(targetDir, "public"));
    await fs.writeFile(
      path.join(targetDir, "index.html"),
      `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>${projectName}</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.jsx"></script>\n</body>\n</html>\n`
    );

    await fs.writeFile(
      path.join(targetDir, "vite.config.js"),
      `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n  server: { port: 3000 }\n});\n`
    );

    const reactPkg = {
      name: projectName,
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview",
      },
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0",
      },
      devDependencies: {
        "@vitejs/plugin-react": "^4.2.0",
        "vite": "^5.0.0"
      }
    };
    await fs.writeJSON(path.join(targetDir, "package.json"), reactPkg, { spaces: 2 });

    await scaffoldGitignore(targetDir, "react");
  }

  getTemplateType() {
    return "react";
  }
}
