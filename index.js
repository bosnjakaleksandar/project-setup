#!/usr/bin/env node
import { input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import ora from 'ora';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log(chalk.bold.cyan('\n🚀 Welcome to the Project Setup CLI!\n'));

  const projectName = await input({
    message: 'What is the name of your project?',
    default: 'project-name',
    validate: (value) => {
      if (value.trim() === '') return 'Project name cannot be empty.';
      if (!/^[a-z0-9-_]+$/.test(value)) return 'Project name can only contain lowercase letters, numbers, dashes, and underscores.';
      return true;
    }
  });

  const projectType = await select({
    message: 'Which type of project do you want to create?',
    choices: [
      { name: 'Next.js Theme', value: 'nextjs', description: 'A Next.js starter' },
      { name: 'React Theme', value: 'react', description: 'A React starter' },
      { name: 'WordPress Theme', value: 'wp-theme', description: 'A WordPress theme' },
      { name: 'WordPress + WooCommerce', value: 'wp-woo', description: 'A WordPress theme with WooCommerce support' }
    ]
  });

  const environment = await select({
    message: 'Which local environment do you prefer?',
    choices: [
      { name: 'Docker (docker-compose)', value: 'docker' },
      { name: 'Lando (.lando.yml)', value: 'lando' }
    ]
  });

  let mysqlVersion = '8.0';
  let wpVersion = 'latest';
  let themeRepo = '';

  if (projectType === 'wp-theme' || projectType === 'wp-woo') {
    mysqlVersion = await select({
      message: 'Choose MySQL version:',
      choices: [
        { name: '8.0 (Recommended)', value: '8.0' },
        { name: '5.7', value: '5.7' },
        { name: 'MariaDB 10.4', value: 'mariadb:10.4' }
      ]
    });

    wpVersion = await input({
      message: 'WordPress version (leave as "latest" or specify version like "6.9.4"):',
      default: 'latest'
    });

    themeRepo = await input({
      message: 'Git template URL to clone as the theme (leave empty for popart starter theme):',
      default: projectType === 'wp-theme' ? 'git@github.com:popart-studio/popart-tema.git' : ''
    });
  }

  console.log('\n');
  const spinner = ora('Scaffolding your project...').start();

  const targetDir = path.join(process.cwd(), projectName);

  try {
    if (await fs.pathExists(targetDir)) {
      spinner.fail(chalk.red(`Directory "${projectName}" already exists! Please choose a different name.`));
      process.exit(1);
    }

    await fs.ensureDir(targetDir);

    const ctx = {
      projectName,
      projectType,
      environment,
      mysqlVersion,
      wpVersion,
      themeRepo
    };

    await scaffoldProjectSrc(targetDir, ctx);

    await scaffoldEnvironment(targetDir, ctx);

    spinner.succeed(chalk.green(`Project "${projectName}" successfully created!`));

    console.log('\n' + chalk.bold('Next steps:'));
    console.log(chalk.cyan(`  cd ${projectName}`));
    if (environment === 'docker') {
      console.log(chalk.cyan(`  docker-compose up -d`));
    } else {
      console.log(chalk.cyan(`  lando start`));
    }
    
    if (projectType === 'nextjs' || projectType === 'react') {
      console.log(chalk.cyan(`  npm install`));
      console.log(chalk.cyan(`  npm run dev`));
    }

    console.log('\n');
  } catch (error) {
    spinner.fail(chalk.red('An error occurred during scaffolding.'));
    console.error(error);
    process.exit(1);
  }
}

async function scaffoldProjectSrc(targetDir, ctx) {
  const { projectName, projectType } = ctx;
  const srcDir = path.join(targetDir, 'src');

  switch (projectType) {
    case 'nextjs':
      await fs.ensureDir(path.join(srcDir, 'app'));
      await fs.writeFile(path.join(srcDir, 'app', 'page.tsx'), `export default function Home() {\n  return <h1>Welcome to ${projectName} (Next.js)</h1>;\n}\n`);
      const nextPkg = {
        name: projectName,
        version: '0.1.0',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start'
        },
        dependencies: {
          next: 'latest',
          react: 'latest',
          'react-dom': 'latest'
        }
      };
      await fs.writeJSON(path.join(targetDir, 'package.json'), nextPkg, { spaces: 2 });
      break;

    case 'react':
      await fs.ensureDir(srcDir);
      await fs.writeFile(path.join(srcDir, 'index.jsx'), `import React from 'react';\nimport { createRoot } from 'react-dom/client';\n\nconst App = () => <h1>Welcome to ${projectName} (React)</h1>;\n\nconst root = createRoot(document.getElementById('root'));\nroot.render(<App />);\n`);
      await fs.ensureDir(path.join(targetDir, 'public'));
      await fs.writeFile(path.join(targetDir, 'public', 'index.html'), `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>${projectName}</title>\n</head>\n<body>\n  <div id="root"></div>\n</body>\n</html>\n`);
      const reactPkg = {
        name: projectName,
        version: '0.1.0',
        private: true,
        scripts: {
          start: 'react-scripts start',
          build: 'react-scripts build'
        },
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          'react-scripts': '5.0.1'
        }
      };
      await fs.writeJSON(path.join(targetDir, 'package.json'), reactPkg, { spaces: 2 });
      break;

    case 'wp-theme':
    case 'wp-woo':
      const themeDir = path.join(targetDir, 'wp-content', 'themes', projectName);
      await fs.ensureDir(themeDir);
      
      if (ctx.themeRepo) {
        console.log(chalk.cyan(`\nCloning theme from ${ctx.themeRepo}...`));
        try {
            execSync(`git clone ${ctx.themeRepo} .`, { stdio: 'inherit', cwd: themeDir });
            await fs.remove(path.join(themeDir, '.git'));
            console.log(chalk.green(`Removed .git tracking from the cloned starter theme.`));
        } catch (e) {
            console.log(chalk.red(`\nFailed to clone repo.`));
        }
      } else {
        const isWoo = projectType === 'wp-woo';
        const wooTags = isWoo ? '\\n * Tags: woocommerce' : '';
        
        await fs.writeFile(path.join(themeDir, 'style.css'), `/*\n * Theme Name: ${projectName}\n * Author: Starter CLI${wooTags}\n */\n`);
        await fs.writeFile(path.join(themeDir, 'index.php'), `<?php\n// The main template file\nget_header();\n?>\n<h1>Welcome to ${projectName}</h1>\n<?php\nget_footer();\n`);
        await fs.writeFile(path.join(themeDir, 'functions.php'), `<?php\n// Theme functions\n${isWoo ? "add_action( 'after_setup_theme', function() { add_theme_support( 'woocommerce' ); } );\n" : ""}`);
      }
      break;
  }
}

async function scaffoldEnvironment(targetDir, ctx) {
  const { projectName, projectType, environment, mysqlVersion, wpVersion } = ctx;

  if (environment === 'docker') {
    let dockerComposeContent = '';

    if (projectType === 'nextjs' || projectType === 'react') {
      dockerComposeContent = `version: '3.8'
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
    } else {
      dockerComposeContent = `version: '3.8'

services:
  db:
    image: mysql:${mysqlVersion}
    volumes:
      - db_data:/var/lib/mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wp_user
      MYSQL_PASSWORD: wp_password

  wordpress:
    depends_on:
      - db
    image: wordpress:${wpVersion === 'latest' ? 'latest' : wpVersion}
    volumes:
      - ./wp-content:/var/www/html/wp-content
    ports:
      - "8080:80"
    restart: always
    environment:
      WORDPRESS_DB_HOST: db
      WORDPRESS_DB_USER: wp_user
      WORDPRESS_DB_PASSWORD: wp_password
      WORDPRESS_DB_NAME: wordpress

  phpmyadmin:
    image: phpmyadmin:latest
    depends_on:
      - db
    ports:
      - "8081:80"
    restart: always
    environment:
      PMA_HOST: db
      PMA_USER: wp_user
      PMA_PASSWORD: wp_password

volumes:
  db_data:
`;
    }

    await fs.writeFile(path.join(targetDir, 'docker-compose.yml'), dockerComposeContent);
  } else if (environment === 'lando') {
    let landoContent = '';

    if (projectType === 'nextjs' || projectType === 'react') {
      landoContent = `name: ${projectName}
recipe: node
config:
  node: '18'
  command: npm run dev
`;
    } else {
      landoContent = `name: ${projectName}
recipe: wordpress
config:
  webroot: .
  php: 8.3
  database: ${mysqlVersion.includes('mariadb') ? 'mariadb:10.4' : `mysql:${mysqlVersion}`}
services:
  appserver:
    ssl: true
    scanner: false
    overrides:
      environment:
        DB_USER: user
        DB_PASSWORD: user
        DB_NAME: wordpress
        DB_HOST: database
        TABLE_PREFIX: wp_
    ports:
      - 5173:5173
    build_as_root:
      - curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
      - apt-get install -y nodejs
    run:
      - if [ ! -d "wp-content" ] || [ ! -d "wp-includes" ] || [ ! -d "wp-admin" ]; then wp core download; fi
      - if [ ! -f "wp-config.php" ]; then wp config create --dbname="wordpress" --dbuser="user" --dbpass="user" --dbhost="database" --dbprefix="wp_"; fi
  database:
    creds:
      user: user
      password: user
      database: wordpress
  pma:
    type: phpmyadmin
  mail:
    type: mailhog
    portforward: true
    hogfrom:
      - appserver
tooling:
  node:
    service: appserver
  npm:
    service: appserver
  npx:
    service: appserver
proxy:
  appserver:
    - ${projectName}.lndo.site
    - vite.${projectName}.lndo.site:5173
  pma:
    - pma.${projectName}.lndo.site
  mail:
    - mail.${projectName}.lndo.site
`;
    }

    await fs.writeFile(path.join(targetDir, '.lando.yml'), landoContent);
  }
}

run();
