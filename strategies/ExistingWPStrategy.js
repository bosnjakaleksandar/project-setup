import BaseStrategy from "./BaseStrategy.js";
import { text, select, isCancel, cancel } from "@clack/prompts";
import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import { execSync } from "child_process";
import WordPressStrategy from "./WordPressStrategy.js";
import { scaffoldGitignore } from "../utils/git.js";

export default class ExistingWPStrategy extends BaseStrategy {
  async askQuestions(ctx) {
    const mysqlVersion = await select({
      message: "Choose MySQL version:",
      options: [
        { label: "8.0 (Recommended)", value: "8.0" },
        { label: "5.7", value: "5.7" },
        { label: "MariaDB 11.4", value: "mariadb:11.4" },
      ],
    });
    if (isCancel(mysqlVersion)) {
      cancel("Operation cancelled.");
      process.exit(0);
    }

    const wpVersion = await text({
      message: 'WordPress version (latest or specify version like "6.9.4"):',
      initialValue: "latest",
    });
    if (isCancel(wpVersion)) {
      cancel("Operation cancelled.");
      process.exit(0);
    }

    const sshKeyPath = await text({
      message:
        "SSH Private Key Path (leave empty to use default system key, e.g., ~/.ssh/key_name):",
      initialValue: "",
      validate: (value) => {
        if (value) {
          const resolvedPath = value.replace(/^~/, process.env.HOME);
          if (!fs.existsSync(resolvedPath)) {
            return "SSH key not found.";
          }
        }
      },
    });
    if (isCancel(sshKeyPath)) {
      cancel("Operation cancelled.");
      process.exit(0);
    }

    const suffix = process.env.STAGING_SUFFIX || ".staging";
    const stagingUrl = await text({
      message: "What is the Staging URL for search-replace?",
      initialValue: `https://${ctx.projectName}${suffix}`,
    });
    if (isCancel(stagingUrl)) {
      cancel("Operation cancelled.");
      process.exit(0);
    }

    return { ...ctx, mysqlVersion, wpVersion, stagingUrl, sshKeyPath };
  }

  async scaffold(targetDir, ctx) {
    const wpStrategy = new WordPressStrategy(this.envService);
    await wpStrategy.scaffoldEnvironment(targetDir, ctx);

    await scaffoldGitignore(targetDir, "wp-existing");

    const suffix = process.env.STAGING_SUFFIX || ".staging";

    const host = process.env.STAGING_SSH_HOST || "staging";
    const sshUserHost = `${ctx.projectName}@${host}`;
    const remoteDir = `${ctx.projectName}/wordpress`;
    const resolvedSshKeyPath = ctx.sshKeyPath ? ctx.sshKeyPath.replace(/^~/, process.env.HOME) : "";
    const sshOpt = resolvedSshKeyPath
      ? `-i ${resolvedSshKeyPath} -o IdentitiesOnly=yes -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no`
      : "";
    const rsyncSshOpt = resolvedSshKeyPath
      ? `-e "ssh -i ${resolvedSshKeyPath} -o IdentitiesOnly=yes"`
      : "";

    console.log(
      chalk.cyan(
        `\n\nPulling uploads, plugins, and themes from ${sshUserHost}...`,
      ),
    );
    try {
      await fs.ensureDir(path.join(targetDir, "wp-content", "uploads"));
      await fs.ensureDir(path.join(targetDir, "wp-content", "plugins"));
      await fs.ensureDir(path.join(targetDir, "wp-content", "themes"));

      execSync(
        `rsync -avz --exclude='*.log' --exclude='node_modules' ${rsyncSshOpt} ${sshUserHost}:${remoteDir}/wp-content/uploads/ wp-content/uploads/`,
        { stdio: "inherit", cwd: targetDir },
      );
      execSync(
        `rsync -avz --exclude='*.log' --exclude='node_modules' ${rsyncSshOpt} ${sshUserHost}:${remoteDir}/wp-content/plugins/ wp-content/plugins/`,
        { stdio: "inherit", cwd: targetDir },
      );
      execSync(
        `rsync -avz --exclude='*.log' --exclude='node_modules' ${rsyncSshOpt} ${sshUserHost}:${remoteDir}/wp-content/themes/ wp-content/themes/`,
        { stdio: "inherit", cwd: targetDir },
      );
    } catch (e) {
      console.log(
        chalk.red(`\nFailed to pull some files via rsync.\nContinuing...`),
      );
    }

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
        `ssh ${sshOpt} ${sshUserHost} "echo ${encoded} | base64 -d | bash"`,
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

    console.log(
      chalk.cyan(
        `\nChecking staging environment for Git repository linkage...`,
      ),
    );
    try {
      const gitRemoteUrl = execSync(
        `ssh ${sshOpt} ${sshUserHost} "cd ${ctx.projectName} && (git config --get remote.origin.url || git -C wordpress config --get remote.origin.url || git -C wordpress/wp-content/themes/${ctx.projectName} config --get remote.origin.url)"`,
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
      // Fail silently if there is simply no .git directory detected
    }

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
          `-e '1s|/\*M!999999\\- enable the sandbox mode \*/||'`,
          `-e 's/utf8mb3_uca1400_ai_ci/utf8_general_ci/g'`,
          `-e 's/utf8mb4_uca1400_ai_ci/utf8mb4_unicode_520_ci/g'`,
          `-e 's/utf8mb3_/utf8_/g'`,
          `staging.sql > staging_fixed.sql && mv staging_fixed.sql staging.sql`,
        ].join(" ");
        execSync(sedCmd, { cwd: targetDir, stdio: "ignore" });
      }

      const envService = this.envService;
      await envService.start(targetDir);

      if (fs.existsSync(path.join(targetDir, "staging.sql"))) {
        await envService.importDb(targetDir, "staging.sql");
        await envService.searchReplace(targetDir, ctx.stagingUrl, localUrl);
        await envService.searchReplace(
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
}
