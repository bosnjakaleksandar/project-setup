import BaseStrategy from "./BaseStrategy.js";
import { text } from "@clack/prompts";
import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import { execSync } from "child_process";
import { scaffoldGitignore } from "../utils/git.js";
import {
  ask,
  askMysqlVersion,
  askWpVersion,
  askSshKeyPath,
} from "../utils/prompts.js";

export default class ExistingWPStrategy extends BaseStrategy {
  async askQuestions(ctx) {
    const mysqlVersion = await askMysqlVersion();
    const wpVersion = await askWpVersion();
    const sshKeyPath = await askSshKeyPath();

    const suffix = process.env.STAGING_SUFFIX || ".staging";
    const stagingUrl = await ask(text, {
      message: "What is the Staging URL for search-replace?",
      initialValue: `https://${ctx.projectName}${suffix}`,
    });

    return { ...ctx, mysqlVersion, wpVersion, stagingUrl, sshKeyPath };
  }

  #resolveSshOptions(ctx) {
    const host = process.env.STAGING_SSH_HOST;
    if (!host) {
      throw new Error(
        "STAGING_SSH_HOST is not set in .env. Cannot connect to staging server.",
      );
    }

    const sshUserHost = `${ctx.projectName}@${host}`;
    const remoteDir = `${ctx.projectName}/wordpress`;
    const resolvedKeyPath = ctx.sshKeyPath
      ? ctx.sshKeyPath.replace(/^~/, process.env.HOME)
      : "";
    const sshOpt = resolvedKeyPath
      ? `-i ${resolvedKeyPath} -o IdentitiesOnly=yes -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no`
      : "";
    const rsyncSshOpt = resolvedKeyPath
      ? `-e "ssh -i ${resolvedKeyPath} -o IdentitiesOnly=yes"`
      : "";

    return { sshUserHost, remoteDir, sshOpt, rsyncSshOpt };
  }

  async #pullRemoteFiles(targetDir, ctx, ssh) {
    console.log(
      chalk.cyan(
        `\n\nPulling uploads, plugins, and themes from ${ssh.sshUserHost}...`,
      ),
    );

    const wpContentDirs = ["uploads", "plugins", "themes"];
    for (const dir of wpContentDirs) {
      await fs.ensureDir(path.join(targetDir, "wp-content", dir));
    }

    try {
      for (const dir of wpContentDirs) {
        execSync(
          `rsync -avz --exclude='*.log' --exclude='node_modules' ${ssh.rsyncSshOpt} ${ssh.sshUserHost}:${ssh.remoteDir}/wp-content/${dir}/ wp-content/${dir}/`,
          { stdio: "inherit", cwd: targetDir },
        );
      }
    } catch (e) {
      console.log(
        chalk.red(`\nFailed to pull some files via rsync.\nContinuing...`),
      );
    }
  }

  async #exportDatabase(targetDir, ctx, ssh) {
    console.log(
      chalk.cyan(`\nExporting and downloading database from staging...`),
    );

    try {
      const dumpCommand = `
cd ${ctx.projectName} || exit 1
DBCONTAINER=$(docker ps --format '{{.Names}}' | grep -i '${ctx.projectName}' | grep -iE 'db|mariadb|mysql' | head -n 1)
if [ -z "$DBCONTAINER" ]; then echo "DB Container not found" >&2; exit 1; fi
echo "Using container: $DBCONTAINER" >&2
USER=$(grep -E '^(DB_USER|MYSQL_USER)=' .env | head -n 1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\\r')
PASS=$(grep -E '^(DB_PASSWORD|MYSQL_PASSWORD)=' .env | head -n 1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\\r')
NAME=$(grep -E '^(DB_NAME|MYSQL_DATABASE)=' .env | head -n 1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '\\r')
echo "DB: $NAME, USER: $USER" >&2
docker exec "$DBCONTAINER" mariadb-dump -u"$USER" -p"$PASS" "$NAME" 2>/dev/null
`.trim();

      const encoded = Buffer.from(dumpCommand).toString("base64");

      const result = execSync(
        `ssh ${ssh.sshOpt} ${ssh.sshUserHost} "echo ${encoded} | base64 -d | bash"`,
        { cwd: targetDir, maxBuffer: 1024 * 1024 * 512 },
      );

      if (!result || result.length < 100) {
        throw new Error(`Dump is empty or too small (${result?.length} bytes)`);
      }

      fs.writeFileSync(path.join(targetDir, "staging.sql"), result);
      console.log(
        chalk.green(
          `Database dump saved to staging.sql (${(result.length / 1024 / 1024).toFixed(2)} MB)`,
        ),
      );
    } catch (e) {
      console.log(chalk.red(`\nFailed to export/download database.`));
      console.error("DB dump error:", e.message);
      console.error("stderr:", e.stderr?.toString());
    }
  }

  async #linkGitRepository(targetDir, ctx, ssh) {
    console.log(
      chalk.cyan(
        `\nChecking staging environment for Git repository linkage...`,
      ),
    );

    try {
      const gitRemoteUrl = execSync(
        `ssh ${ssh.sshOpt} ${ssh.sshUserHost} "cd ${ctx.projectName} && (git config --get remote.origin.url || git -C wordpress config --get remote.origin.url || git -C wordpress/wp-content/themes/${ctx.projectName} config --get remote.origin.url)"`,
        { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] },
      ).trim();

      if (gitRemoteUrl) {
        console.log(
          chalk.green(`Found mapping to staging Git origin: ${gitRemoteUrl}`),
        );
        ctx.stagingRepoUrl = gitRemoteUrl;
        ctx.skipGitInit = true;

        execSync(`git init`, { cwd: targetDir, stdio: "ignore" });
        execSync(`git remote add origin ${gitRemoteUrl}`, {
          cwd: targetDir,
          stdio: "ignore",
        });
        console.log(
          chalk.gray(
            `Initialized local Git repository and synced remote origin.`,
          ),
        );
      } else {
        console.log(
          chalk.yellow(`No Git remote origin found in staging environment.`),
        );
      }
    } catch (e) {
      console.log(chalk.gray(`No Git repository detected on staging.`));
    }
  }

  async #importAndReplace(targetDir, ctx) {
    const suffix = process.env.STAGING_SUFFIX || ".staging";
    const localUrl =
      ctx.environment === "lando"
        ? `https://${ctx.projectName}.lndo.site`
        : `http://localhost:8080`;

    console.log(
      chalk.cyan(`\nStarting local environment and importing database...`),
    );

    try {
      if (fs.existsSync(path.join(targetDir, "staging.sql"))) {
        console.log(
          chalk.yellow(
            `Fixing unsupported collations in staging.sql for local compatibility...`,
          ),
        );
        const sedCmd = [
          `LC_ALL=C sed`,
          `-e '1s|/\\*M!999999\\\\- enable the sandbox mode \\*/||'`,
          `-e 's/utf8mb3_uca1400_ai_ci/utf8_general_ci/g'`,
          `-e 's/utf8mb4_uca1400_ai_ci/utf8mb4_unicode_520_ci/g'`,
          `-e 's/utf8mb3_/utf8_/g'`,
          `staging.sql > staging_fixed.sql && mv staging_fixed.sql staging.sql`,
        ].join(" ");
        execSync(sedCmd, { cwd: targetDir, stdio: "ignore" });
      }

      await this.envService.start(targetDir);

      if (fs.existsSync(path.join(targetDir, "staging.sql"))) {
        await this.envService.importDb(targetDir, "staging.sql");
        await this.envService.searchReplace(
          targetDir,
          ctx.stagingUrl,
          localUrl,
        );
        await this.envService.searchReplace(
          targetDir,
          `http://${ctx.projectName}${suffix}`,
          localUrl,
        );

        console.log(
          chalk.green(
            `\nDatabase imported and search-replace completed successfully!`,
          ),
        );
        fs.removeSync(path.join(targetDir, "staging.sql"));
        console.log(chalk.gray(`\nTemporary staging.sql file removed.`));
      }
    } catch (e) {
      console.log(chalk.red(`\nFailed during environment start or db import.`));
      console.error("Error:", e.message);
    }
  }

  async scaffoldSrc(targetDir, ctx) {
    const ssh = this.#resolveSshOptions(ctx);

    await scaffoldGitignore(targetDir, "wp-existing");
    await this.#pullRemoteFiles(targetDir, ctx, ssh);
    await this.#exportDatabase(targetDir, ctx, ssh);
    await this.#linkGitRepository(targetDir, ctx, ssh);
    await this.#importAndReplace(targetDir, ctx);
  }

  getTemplateType() {
    return "wordpress";
  }
}
