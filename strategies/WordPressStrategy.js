import BaseStrategy from "./BaseStrategy.js";
import { text, select, isCancel, cancel } from "@clack/prompts";
import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import { execSync } from "child_process";
import EnvironmentFactory from "../services/EnvironmentFactory.js";
import GitService from "../services/GitService.js";

export default class WordPressStrategy extends BaseStrategy {
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

    const themeRepo = await text({
      message:
        "Git template URL to clone as the theme (defaults to starter theme from env):",
      initialValue:
        process.env.WP_THEME_REPO || "git@github.com:starter-theme.git",
    });
    if (isCancel(themeRepo)) {
      cancel("Operation cancelled.");
      process.exit(0);
    }

    let sshKeyPath = "";
    if (themeRepo) {
      sshKeyPath = await text({
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
    }

    return { ...ctx, mysqlVersion, wpVersion, themeRepo, sshKeyPath };
  }

  async scaffoldSrc(targetDir, ctx) {
    const { projectName, projectType, themeRepo } = ctx;
    const themeDir = path.join(targetDir, "wp-content", "themes", projectName);
    await fs.ensureDir(themeDir);

    if (themeRepo) {
      let branchFlag = "";
      if (projectType === "wp-woo") {
        const wooBranch = process.env.WP_WOO_BRANCH || "woocommerce";
        branchFlag = `-b ${wooBranch} `;
      } else if (projectType === "wp-react") {
        const reactBranch = process.env.WP_REACT_BRANCH || "react";
        branchFlag = `-b ${reactBranch} `;
      }

      console.log(
        chalk.cyan(
          `\nCloning theme from ${themeRepo}${branchFlag ? ` (${branchFlag.trim()})` : ""}...`,
        ),
      );
      try {
        let envVars = { ...process.env };
        if (ctx.sshKeyPath) {
          const resolvedKeyPath = ctx.sshKeyPath.replace(/^~/, process.env.HOME);
          envVars.GIT_SSH_COMMAND = `ssh -i ${resolvedKeyPath} -o IdentitiesOnly=yes`;
        }

        execSync(`git clone ${branchFlag}${themeRepo} .`, {
          stdio: "inherit",
          cwd: themeDir,
          env: envVars,
        });
        await fs.remove(path.join(themeDir, ".git"));
        console.log(
          chalk.green(`Removed .git tracking from the cloned starter theme.`),
        );
      } catch (e) {
        console.log(chalk.red(`\nFailed to clone repo.`));
      }
    } else {
      await fs.writeFile(
        path.join(themeDir, "style.css"),
        `/*\n * Theme Name: ${projectName}\n * Author: Starter CLI\n */\n`,
      );

      await fs.writeFile(
        path.join(themeDir, "index.php"),
        `<?php\n// The main template file\nget_header();\n?>\n<h1>Welcome to ${projectName}</h1>\n<?php\nget_footer();\n`,
      );

      await fs.writeFile(
        path.join(themeDir, "functions.php"),
        `<?php\n// Theme functions\n`,
      );
    }

    await GitService.scaffoldGitignore(targetDir, "wordpress");
  }

  async scaffoldEnvironment(targetDir, ctx) {
    const envService = EnvironmentFactory.getService(ctx.environment);
    await envService.scaffold(targetDir, "wordpress", ctx);
  }
}
