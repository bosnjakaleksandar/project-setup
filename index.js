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
import { createProjectPost } from "./utils/wpApi.js";

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

    const doGitInit = await select({
      message: "Do you want to initialize a new Git repository?",
      choices: [{ name: "Yes", value: true }, { name: "No", value: false }]
    });

    if (doGitInit) {
      try {
        execSync("git init", { cwd: targetDir, stdio: "ignore" });
        console.log(chalk.green("Initialized empty Git repository.\n"));
      } catch (err) {
        console.log(chalk.red("Failed to initialize git.\n"));
      }
    }

    const sendToWp = await select({
      message: "Do you want to register this project on the Knowledge Base (Baza Znanja)?",
      choices: [{ name: "Yes", value: true }, { name: "No", value: false }]
    });

    if (sendToWp) {
      const repoUrl = await input({ 
        message: "What is the Github Repository URL (SSH or HTTP)?",
        default: "" 
      });
      
      const stagingUrl = await input({ 
        message: "What is the Staging URL?",
        default: `https://${projectName}.popart.cloud`
      });

      let defaultDevName = 'Unknown Developer';
      try {
        defaultDevName = execSync('git config user.name').toString().trim();
      } catch (e) {}

      const developerName = await input({
        message: "Developer Name:",
        default: defaultDevName
      });

      const envChoice = await select({
        message: "Where is the Knowledge Base running?",
        choices: [
          { name: "Local (http://localhost:8000)", value: "http://localhost:8000" },
          { name: "Staging (https://baza-znanja.popart.cloud)", value: "https://baza-znanja.popart.cloud" },
          { name: "Custom URL", value: "custom" }
        ]
      });

      let wpSiteUrl = envChoice;
      if (envChoice === "custom") {
        wpSiteUrl = await input({
          message: "Enter the Base URL of the Knowledge Base:"
        });
      }
      
      const spinnerWp = ora("Registering project on Knowledge Base...").start();
      try {
        const post = await createProjectPost({
          wpSiteUrl,
          developerName,
          projectName,
          repoUrl,
          stagingUrl
        });
        spinnerWp.succeed(chalk.green(`Project registered! Post ID: ${post.id}`));
      } catch(err) {
        spinnerWp.fail(chalk.red("Failed to register project on Knowledge Base."));
        console.error(err.message);
      }
    }

  } catch (error) {
    spinner.fail(chalk.red("An error occurred during scaffolding."));
    console.error(error);
    process.exit(1);
  }
}

run();
