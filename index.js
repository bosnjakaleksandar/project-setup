#!/usr/bin/env node
import { intro, outro, spinner, confirm, select, text } from "@clack/prompts";
import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import { execSync } from "child_process";

import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

import NextjsStrategy from "./strategies/NextjsStrategy.js";
import ReactStrategy from "./strategies/ReactStrategy.js";
import WordPressStrategy from "./strategies/WordPressStrategy.js";
import LaravelStrategy from "./strategies/LaravelStrategy.js";
import ExistingWPStrategy from "./strategies/ExistingWPStrategy.js";
import LandoService from "./services/LandoService.js";
import DockerComposeService from "./services/DockerComposeService.js";
import { registerOnKnowledgeBase } from "./services/KnowledgeBaseService.js";
import { showBanner } from "./utils/banner.js";
import { ask } from "./utils/prompts.js";

function resolveStrategy(ctx, envService) {
  if (ctx.setupType === "existing-wp") {
    return new ExistingWPStrategy(envService);
  }

  if (ctx.appType === "application") {
    const frontendStrategy =
      ctx.framework === "nextjs"
        ? new NextjsStrategy(envService)
        : new ReactStrategy(envService);

    return ctx.useLaravel
      ? new LaravelStrategy(envService, frontendStrategy)
      : frontendStrategy;
  }

  return new WordPressStrategy(envService);
}

async function run() {
  await showBanner();

  intro(chalk.bgCyan(chalk.black(" 🚀 CLI START ")));

  const setupType = await ask(select, {
    message: "What would you like to do?",
    options: [
      { label: "Create a new project", value: "new" },
      { label: "Set up an existing WP project", value: "existing-wp" },
    ],
  });

  const projectName = await ask(text, {
    message: "What is the name of your project?",
    initialValue: "project-name",
    validate: (value) => {
      if (value.trim() === "") return "Project name cannot be empty.";
      if (!/^[a-z0-9-_]+$/.test(value))
        return "Project name can only contain lowercase letters, numbers, dashes, and underscores.";
      return;
    },
  });

  let appType = null;
  let framework = null;
  let useLaravel = false;
  let wpType = null;
  let projectType = null;

  if (setupType === "new") {
    appType = await ask(select, {
      message: "Are you building an Application or a WordPress project?",
      options: [
        { label: "Application", value: "application" },
        { label: "WordPress", value: "wordpress" },
      ],
    });

    if (appType === "application") {
      framework = await ask(select, {
        message: "Which frontend framework do you want to use?",
        options: [
          { label: "React", value: "react" },
          { label: "Next.js", value: "nextjs" },
        ],
      });

      useLaravel = await ask(confirm, {
        message: "Do you want to add Laravel as a backend?",
        initialValue: false,
      });

      projectType = framework;
    } else {
      wpType = await ask(select, {
        message: "Which WordPress project setup do you need?",
        options: [
          { label: "Standard Theme", value: "wp-theme" },
          { label: "WordPress + WooCommerce", value: "wp-woo" },
          { label: "WordPress + React", value: "wp-react" },
        ],
      });

      projectType = wpType;
    }
  } else {
    appType = "wordpress";
    projectType = "wp-existing";
  }

  const environment = await ask(select, {
    message: "Which local environment do you prefer?",
    options: [
      { label: "Docker (docker-compose.yaml)", value: "docker" },
      { label: "Lando (.lando.yml)", value: "lando" },
    ],
  });

  let ctx = {
    setupType,
    projectName,
    projectType,
    appType,
    framework,
    useLaravel,
    wpType,
    environment,
  };

  const envService =
    environment === "lando" ? new LandoService() : new DockerComposeService();
  const strategy = resolveStrategy(ctx, envService);

  ctx = await strategy.askQuestions(ctx);

  const s = spinner();
  s.start("Scaffolding your project...");

  const targetDir = path.join(process.cwd(), projectName);

  try {
    if (await fs.pathExists(targetDir)) {
      s.stop("Directory exists!");
      console.log(
        chalk.red(
          `Directory "${projectName}" already exists! Please choose a different name.`,
        ),
      );
      process.exit(1);
    }

    await fs.ensureDir(targetDir);
    await strategy.scaffold(targetDir, ctx);

    s.stop(`Project ${chalk.green(projectName)} successfully created!`);

    let nextSteps = `  cd ${projectName}\n`;

    if (setupType === "existing-wp") {
      nextSteps += `  ${chalk.gray(`# ${environment === "docker" ? "Docker" : "Lando"} environment is already running`)}\n`;
      
      const themeDir = path.join(targetDir, "wp-content", "themes", projectName);
      const hasPkg = await fs.pathExists(path.join(themeDir, "package.json"));
      const hasComposer = await fs.pathExists(path.join(themeDir, "composer.json"));
      
      if (hasPkg || hasComposer) {
        nextSteps += `  cd wp-content/themes/${projectName}\n`;
        if (hasComposer) nextSteps += `  composer install\n`;
        if (hasPkg) {
          nextSteps += `  npm install\n`;
          nextSteps += `  npm run dev\n`;
        }
      }
    } else if (appType === "wordpress") {
      if (environment === "docker") {
        nextSteps += `  docker-compose up -d\n`;
      } else {
        nextSteps += `  lando start\n`;
      }

      const themeDir = path.join(targetDir, "wp-content", "themes", projectName);
      const hasPkg = await fs.pathExists(path.join(themeDir, "package.json"));
      const hasComposer = await fs.pathExists(path.join(themeDir, "composer.json"));

      if (hasPkg || hasComposer) {
        nextSteps += `  cd wp-content/themes/${projectName}\n`;
        if (hasComposer) nextSteps += `  composer install\n`;
        if (hasPkg) {
          nextSteps += `  npm install\n`;
          nextSteps += `  npm run dev\n`;
        }
      } else if (ctx.themeRepo) {
        nextSteps += `  cd wp-content/themes/${projectName}\n`;
        nextSteps += `  npm install && npm run dev ${chalk.gray("(if required)")}\n`;
      }
    } else {
      if (environment === "docker") {
        nextSteps += `  docker-compose up -d\n`;
      } else {
        nextSteps += `  lando start\n`;
      }

      if (projectType === "nextjs" || projectType === "react") {
        if (ctx.useLaravel) {
          nextSteps += `  cd frontend\n`;
        }
        nextSteps += `  npm install\n`;
        nextSteps += `  npm run dev\n`;
      }
    }

    nextSteps = nextSteps.replace(/\n$/, "");

    if (!ctx.skipGitInit) {
      const doGitInit = await ask(confirm, {
        message: "Do you want to initialize a new Git repository?",
        initialValue: true,
      });

      if (doGitInit) {
        try {
          execSync("git init", { cwd: targetDir, stdio: "ignore" });
          console.log(chalk.gray("│  Initialized empty Git repository."));
        } catch (err) {
          console.log(chalk.red("│  Failed to initialize git."));
        }
      }
    }

    await registerOnKnowledgeBase(ctx);

    outro(`Next steps:\n${nextSteps}\n\n${chalk.cyan("Happy coding!")}`);
  } catch (error) {
    s.stop(chalk.red("An error occurred."));
    console.error(error);
    process.exit(1);
  }
}

run();
