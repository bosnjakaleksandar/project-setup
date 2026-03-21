#!/usr/bin/env node
import { input, select } from "@inquirer/prompts";
import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import ora from "ora";

import NextjsStrategy from "./strategies/NextjsStrategy.js";
import ReactStrategy from "./strategies/ReactStrategy.js";
import WordPressStrategy from "./strategies/WordPressStrategy.js";
import LaravelStrategy from "./strategies/LaravelStrategy.js";

async function run() {
  console.log(chalk.bold.cyan("\n🚀 Welcome to the Project Setup CLI!\n"));

  const projectName = await input({
    message: "What is the name of your project?",
    default: "project-name",
    validate: (value) => {
      if (value.trim() === "") return "Project name cannot be empty.";
      if (!/^[a-z0-9-_]+$/.test(value))
        return "Project name can only contain lowercase letters, numbers, dashes, and underscores.";
      return true;
    },
  });

  const appType = await select({
    message: "Are you building an Application or a WordPress project?",
    choices: [
      { name: "Application", value: "application" },
      { name: "WordPress", value: "wordpress" },
    ],
  });

  let framework = null;
  let useLaravel = false;
  let wpType = null;
  let projectType = null;

  if (appType === "application") {
    framework = await select({
      message: "Which frontend framework do you want to use?",
      choices: [
        { name: "React (Vite)", value: "react" },
        { name: "Next.js", value: "nextjs" },
      ],
    });
    
    useLaravel = await select({
      message: "Do you want to add Laravel as a backend API?",
      choices: [
        { name: "Yes", value: true },
        { name: "No", value: false },
      ],
    });
    
    projectType = framework;
  } else {
    wpType = await select({
      message: "Which WordPress project setup do you need?",
      choices: [
        { name: "Standard Theme", value: "wp-theme" },
        { name: "WordPress + WooCommerce", value: "wp-woo" },
        { name: "WordPress + React", value: "wp-react" },
      ],
    });
    
    projectType = wpType;
  }

  const environment = await select({
    message: "Which local environment do you prefer?",
    choices: [
      { name: "Docker (docker-compose)", value: "docker" },
      { name: "Lando (.lando.yml)", value: "lando" },
    ],
  });

  let ctx = {
    projectName,
    projectType,
    appType,
    framework,
    useLaravel,
    wpType,
    environment,
  };

  let strategy;
  if (appType === "application") {
    const frontendStrategy = framework === "nextjs" ? new NextjsStrategy() : new ReactStrategy();
    if (useLaravel) {
      strategy = new LaravelStrategy(frontendStrategy);
    } else {
      strategy = frontendStrategy;
    }
  } else {
    strategy = new WordPressStrategy();
  }

  ctx = await strategy.askQuestions(ctx);

  console.log("\n");
  const spinner = ora("Scaffolding your project...").start();

  const targetDir = path.join(process.cwd(), projectName);

  try {
    if (await fs.pathExists(targetDir)) {
      spinner.fail(
        chalk.red(
          `Directory "${projectName}" already exists! Please choose a different name.`,
        ),
      );
      process.exit(1);
    }

    await fs.ensureDir(targetDir);

    await strategy.scaffold(targetDir, ctx);

    spinner.succeed(
      chalk.green(`Project "${projectName}" successfully created!`),
    );

    console.log("\n" + chalk.bold("Next steps:"));
    console.log(chalk.cyan(`  cd ${projectName}`));
    if (environment === "docker") {
      console.log(chalk.cyan(`  docker-compose up -d`));
    } else {
      console.log(chalk.cyan(`  lando start`));
    }

    if (projectType === "nextjs" || projectType === "react") {
      console.log(chalk.cyan(`  npm install`));
      console.log(chalk.cyan(`  npm run dev`));
    }

    console.log("\n");
  } catch (error) {
    spinner.fail(chalk.red("An error occurred during scaffolding."));
    console.error(error);
    process.exit(1);
  }
}

run();
