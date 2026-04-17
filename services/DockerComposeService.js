import EnvironmentService from "./EnvironmentService.js";
import fs from "fs-extra";
import path from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import { fileURLToPath } from "url";
import { resolveTemplateName, resolveDbImage } from "../utils/templateMap.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default class DockerComposeService extends EnvironmentService {
  async scaffold(targetDir, type, options) {
    const { projectName, mysqlVersion, wpVersion } = options;
    const templateName = resolveTemplateName(type);

    const templatePath = path.join(
      __dirname,
      "..",
      "templates",
      "docker",
      `${templateName}.yaml.tpl`,
    );
    let content = await fs.readFile(templatePath, "utf-8");

    if (mysqlVersion) {
      content = content.replace(/{{DB_IMAGE}}/g, resolveDbImage(mysqlVersion));
    }

    if (wpVersion) {
      const wpImageTag = wpVersion === "latest" ? "latest" : wpVersion;
      content = content.replace(/{{WP_VERSION}}/g, wpImageTag);
    }

    content = content.replace(/{{PROJECT_NAME}}/g, projectName);

    await fs.writeFile(path.join(targetDir, "docker-compose.yaml"), content);
  }

  async start(targetDir) {
    execSync("docker-compose up -d", { stdio: "inherit", cwd: targetDir });
  }

  async isDbReady(targetDir) {
    try {
      execSync(
        `docker-compose exec -T db sh -c '(mariadb -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "SELECT 1" "$MYSQL_DATABASE" 2>/dev/null) || (mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" -e "SELECT 1" "$MYSQL_DATABASE" 2>/dev/null)'`,
        { stdio: "ignore", cwd: targetDir },
      );
      return true;
    } catch {
      return false;
    }
  }

  async waitForDb(targetDir, timeoutSeconds = 60) {
    console.log(chalk.yellow(`Waiting for database to be ready...`));
    let waited = 0;
    while (!(await this.isDbReady(targetDir))) {
      if (waited >= timeoutSeconds) {
        console.log(
          chalk.red(
            `Database did not become ready after ${timeoutSeconds}s, proceeding anyway...`,
          ),
        );
        break;
      }
      // Use async sleep instead of blocking execSync("sleep 2")
      await new Promise((resolve) => setTimeout(resolve, 2000));
      waited += 2;
      process.stdout.write(
        chalk.yellow(`\rWaiting for database... ${waited}s`),
      );
    }
    if (waited < timeoutSeconds)
      console.log(chalk.green(`\rDatabase ready after ${waited}s!          `));
  }

  async ensureWpCli(targetDir) {
    try {
      execSync(
        'docker-compose exec -T wordpress bash -c "curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && chmod +x wp-cli.phar && mv wp-cli.phar /usr/local/bin/wp"',
        { stdio: "ignore", cwd: targetDir },
      );
    } catch (e) {
      console.log(
        chalk.red(`\nFailed to install WP-CLI inside the docker container.`),
      );
    }
  }

  async importDb(targetDir, sqlFile) {
    await this.waitForDb(targetDir);
    await this.ensureWpCli(targetDir);

    execSync(`docker-compose cp ${sqlFile} db:/tmp/${sqlFile}`, {
      stdio: "inherit",
      cwd: targetDir,
    });
    execSync(
      `docker-compose exec -T db sh -c '{ echo "[client]"; echo "user=$MYSQL_USER"; echo "password=$MYSQL_PASSWORD"; } > /tmp/my.cnf && (mariadb --defaults-file=/tmp/my.cnf "$MYSQL_DATABASE" < /tmp/${sqlFile} 2>/dev/null || mysql --defaults-file=/tmp/my.cnf "$MYSQL_DATABASE" < /tmp/${sqlFile}) && rm /tmp/my.cnf'`,
      { stdio: "inherit", cwd: targetDir },
    );
  }

  async searchReplace(targetDir, from, to) {
    execSync(
      `docker-compose exec -T -u www-data wordpress wp search-replace '${from}' '${to}'`,
      { stdio: "inherit", cwd: targetDir },
    );
  }

  async runWpCommand(targetDir, command) {
    execSync(`docker-compose exec -T -u www-data wordpress wp ${command}`, {
      stdio: "inherit",
      cwd: targetDir,
    });
  }
}
