#!/usr/bin/env node
import { input, select } from "@inquirer/prompts";
import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import ora from "ora";

import NextjsStrategy from "./strategies/NextjsStrategy.js";
import ReactStrategy from "./strategies/ReactStrategy.js";
import WordPressStrategy from "./strategies/WordPressStrategy.js";

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

  const projectType = await select({
    message: "Which type of project do you want to create?",
    choices: [
      {
        name: "Next.js",
        value: "nextjs",
        description: "A Next.js starter",
      },
      { name: "React", value: "react", description: "A React starter" },
      {
        name: "WordPress",
        value: "wp-theme",
        description: "A WordPress starter with custom theme",
      },
      {
        name: "WordPress + WooCommerce",
        value: "wp-woo",
        description:
          "A WordPress starter with custom theme and WooCommerce support",
      },
      {
        name: "WordPress + React",
        value: "wp-react",
        description:
          "A WordPress starter with custom theme and React support",
      },
    ],
  });

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
    environment,
  };

  let strategy;
  switch (projectType) {
    case "nextjs":
      strategy = new NextjsStrategy();
      break;
    case "react":
      strategy = new ReactStrategy();
      break;
    case "wp-theme":
    case "wp-woo":
      strategy = new WordPressStrategy();
      break;
    default:
      console.log(chalk.red("Unknown project type selected."));
      process.exit(1);
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
