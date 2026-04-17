import BaseStrategy from "./BaseStrategy.js";
import { select } from "@clack/prompts";
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

export default class WordPressStrategy extends BaseStrategy {
  async askQuestions(ctx) {
    const mysqlVersion = await askMysqlVersion();
    const wpVersion = await askWpVersion();

    const themeRepo = await ask(select, {
      message:
        "Git template URL to clone as the theme (defaults to starter theme from env):",
      options: [
        {
          label:
            process.env.WP_THEME_REPO || "git@github.com:starter-theme.git",
          value:
            process.env.WP_THEME_REPO || "git@github.com:starter-theme.git",
        },
        { label: "No template (scaffold minimal theme files)", value: "" },
      ],
    });

    let sshKeyPath = "";
    if (themeRepo) {
      sshKeyPath = await askSshKeyPath();
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
          const resolvedKeyPath = ctx.sshKeyPath.replace(
            /^~/,
            process.env.HOME,
          );
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
        await fs.remove(themeDir);
        throw new Error(
          `Failed to clone theme repository: ${themeRepo}\n${e.message}`,
        );
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

    await scaffoldGitignore(targetDir, "wordpress");
  }

  getTemplateType() {
    return "wordpress";
  }
}
