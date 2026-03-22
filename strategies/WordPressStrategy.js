import BaseStrategy from './BaseStrategy.js';
import { text, select, isCancel, cancel } from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

export default class WordPressStrategy extends BaseStrategy {
  async askQuestions(ctx) {

    const mysqlVersion = await select({
      message: "Choose MySQL version:",
      options: [
        { label: "8.0 (Recommended)", value: "8.0" },
        { label: "5.7", value: "5.7" },
        { label: "MariaDB 10.4", value: "mariadb:10.4" },
      ],
    });
    if (isCancel(mysqlVersion)) { cancel("Operation cancelled."); process.exit(0); }

    const wpVersion = await text({
      message: 'WordPress version (latest or specify version like "6.9.4"):', 
      initialValue: "latest",
    });
    if (isCancel(wpVersion)) { cancel("Operation cancelled."); process.exit(0); }

    const themeRepo = await text({
      message: "Git template URL to clone as the theme (defaults to popart starter theme):",
      initialValue: "git@github.com:popart-studio/popart-tema.git",
    });
    if (isCancel(themeRepo)) { cancel("Operation cancelled."); process.exit(0); }

    return { ...ctx, mysqlVersion, wpVersion, themeRepo };
  }

  async scaffoldSrc(targetDir, ctx) {
    const { projectName, projectType, themeRepo } = ctx;
    const themeDir = path.join(targetDir, "wp-content", "themes", projectName);
    await fs.ensureDir(themeDir);

    if (themeRepo) {
      let branchFlag = '';
      if (projectType === 'wp-woo') {
        branchFlag = '-b woocommerce ';
      } else if (projectType === 'wp-react') {
        branchFlag = '-b react ';
      }

      console.log(chalk.cyan(`\nCloning theme from ${themeRepo}${branchFlag ? ` (${branchFlag.trim()})` : ''}...`));
      try {
        execSync(`git clone ${branchFlag}${themeRepo} .`, {
          stdio: "inherit",
          cwd: themeDir,
        });
        await fs.remove(path.join(themeDir, ".git"));
        console.log(chalk.green(`Removed .git tracking from the cloned starter theme.`));
      } catch (e) {
        console.log(chalk.red(`\nFailed to clone repo.`));
      }
    } else {
      await fs.writeFile(
        path.join(themeDir, "style.css"),
        `/*\n * Theme Name: ${projectName}\n * Author: Starter CLI\n */\n`
      );

      await fs.writeFile(
        path.join(themeDir, "index.php"),
        `<?php\n// The main template file\nget_header();\n?>\n<h1>Welcome to ${projectName}</h1>\n<?php\nget_footer();\n`
      );

      await fs.writeFile(
        path.join(themeDir, "functions.php"),
        `<?php\n// Theme functions\n`
      );
    }

    const gitignoreContent = `# Wordpress - ignore core, configuration, examples, uploads and logs.
# https://github.com/github/gitignore/blob/main/WordPress.gitignore

# Core
#
# Note: if you want to stage/commit WP core files
# you can delete this whole section/until Configuration.
vendor
node_modules
/wp-admin/
/wp-content/index.php
/wp-content/languages
/wp-content/plugins/index.php
/wp-content/themes/index.php
/wp-includes/
/index.php
/license.txt
/readme.html
/wp-*.php
/xmlrpc.php

# Configuration
wp-config.php

# Example themes
/wp-content/themes/twenty*/

# Example plugin
/wp-content/plugins/
/wp-content/plugins/hello.php

# Uploads
/wp-content/uploads/

# Log files
*.log

# htaccess
/.htaccess

upgrade
upgrade-temp-backup

/wp-cli
wp.bat

dist
# All plugins
#
# Note: If you wish to whitelist plugins,
# uncomment the next line
#/wp-content/plugins

# All themes
#
# Note: If you wish to whitelist themes,
# uncomment the next line
#/wp-content/themes


*.sql
*.DS_Store
php.ini
`;
    await fs.writeFile(path.join(targetDir, ".gitignore"), gitignoreContent);
  }

  async scaffoldEnvironment(targetDir, ctx) {
    const { projectName, environment, mysqlVersion, wpVersion } = ctx;

    if (environment === "docker") {
      const dockerComposeContent = `
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
    image: wordpress:${wpVersion === "latest" ? "latest" : wpVersion}
    volumes:
      - .:/var/www/html
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
    platform: linux/amd64
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
      await fs.writeFile(
        path.join(targetDir, "docker-compose.yaml"),
        dockerComposeContent
      );
    } else if (environment === "lando") {
      const landoContent = `name: ${projectName}
recipe: wordpress
config:
  webroot: .
  php: 8.3
  database: ${mysqlVersion.includes("mariadb") ? "mariadb:10.4" : `mysql:${mysqlVersion}`}
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
      await fs.writeFile(path.join(targetDir, ".lando.yml"), landoContent);
    }
  }
}
