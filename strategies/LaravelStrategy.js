import BaseStrategy from './BaseStrategy.js';
import fs from 'fs-extra';
import path from 'path';

export default class LaravelStrategy extends BaseStrategy {
  constructor(frontendStrategy) {
    super();
    this.frontendStrategy = frontendStrategy;
  }

  async askQuestions(ctx) {
    return await this.frontendStrategy.askQuestions(ctx);
  }

  async scaffoldSrc(targetDir, ctx) {
    const { projectName } = ctx;
    
    const backendDir = path.join(targetDir, "backend");
    const frontendDir = path.join(targetDir, "frontend");
    
    await fs.ensureDir(backendDir);
    await fs.ensureDir(frontendDir);
    
    const frontendCtx = { ...ctx, isFullStack: true };
    await this.frontendStrategy.scaffoldSrc(frontendDir, frontendCtx);

    await fs.ensureDir(path.join(backendDir, "app"));
    await fs.ensureDir(path.join(backendDir, "config"));
    await fs.ensureDir(path.join(backendDir, "routes"));

    await fs.writeFile(
      path.join(backendDir, "config", "cors.php"),
      `<?php\n\nreturn [\n    'paths' => ['api/*', 'sanctum/csrf-cookie'],\n    'allowed_methods' => ['*'],\n    'allowed_origins' => ['*'],\n    'allowed_origins_patterns' => [],\n    'allowed_headers' => ['*'],\n    'exposed_headers' => [],\n    'max_age' => 0,\n    'supports_credentials' => false,\n];\n`
    );

    await fs.writeFile(
      path.join(backendDir, "routes", "api.php"),
      `<?php\n\nuse Illuminate\\Http\\Request;\nuse Illuminate\\Support\\Facades\\Route;\n\nRoute::middleware('auth:sanctum')->get('/user', function (Request $request) {\n    return $request->user();\n});\n`
    );

    await fs.writeFile(
      path.join(backendDir, "composer.json"),
      `{\n    "name": "laravel/laravel",\n    "type": "project",\n    "description": "The Laravel Framework.",\n    "keywords": ["framework", "laravel"],\n    "license": "MIT",\n    "require": {\n        "php": "^8.1.0",\n        "laravel/framework": "^10.0",\n        "laravel/sanctum": "^3.2",\n        "laravel/tinker": "^2.8"\n    }\n}\n`
    );

    await fs.writeFile(
      path.join(targetDir, "README.md"),
      `# ${projectName}\n\nThis is a full-stack Laravel + ${ctx.framework} project.\n\n## Backend\nNavigate to \`backend/\` to view the Laravel app.\n\n## Frontend\nNavigate to \`frontend/\` to view the UI application. It is pre-configured to communicate with the Laravel backend API.\n`
    );
  }

  async scaffoldEnvironment(targetDir, ctx) {
    const { projectName, environment } = ctx;

    if (environment === "docker") {
      const dockerComposeContent = `version: '3.8'
services:
  frontend:
    image: node:18-alpine
    working_dir: /app
    volumes:
      - ./frontend:/app
    ports:
      - "3000:3000"
    command: npm run dev
    depends_on:
      - backend

  backend:
    image: php:8.2-fpm
    working_dir: /var/www/html
    volumes:
      - ./backend:/var/www/html
    ports:
      - "8000:8000"
    command: php -S 0.0.0.0:8000 -t public
`;
      await fs.writeFile(
        path.join(targetDir, "docker-compose.yaml"),
        dockerComposeContent
      );
    } else if (environment === "lando") {
      const landoContent = `name: ${projectName}
recipe: laravel
config:
  webroot: backend/public
  php: '8.2'
  database: mysql:8.0
services:
  frontend:
    type: node:18
    overrides:
      ports:
        - "3000:3000"
tooling:
  npm:
    service: frontend
  node:
    service: frontend
`;
      await fs.writeFile(path.join(targetDir, ".lando.yml"), landoContent);
    }
  }
}
