#!/usr/bin/env node
import { text, select, isCancel, cancel, intro, outro, spinner, confirm } from "@clack/prompts";
import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import { execSync } from "child_process";
import figlet from "figlet";
import gradient from "gradient-string";

import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

import NextjsStrategy from "./strategies/NextjsStrategy.js";
import ReactStrategy from "./strategies/ReactStrategy.js";
import WordPressStrategy from "./strategies/WordPressStrategy.js";
import LaravelStrategy from "./strategies/LaravelStrategy.js";
import { createProjectPost } from "./utils/wpApi.js";

async function run() {
  console.log("");
  
  const asciiArt = figlet.textSync("PROJECT SETUP", {
    font: "Standard",
  });
  console.log(gradient(['#ffb800', '#ff6a00']).multiline(asciiArt));
  
  const frames = [
    `  ╭───────╮  Aca:\n  │ ^ ◡ ^ │  Ready to build something awesome?\n  ╰───────╯`,
    `  ╭───────╮  Aca:\n  │ o ◡ o │  Ready to build something awesome?\n  ╰───────╯`,
    `  ╭───────╮  Aca:\n  │ - ◡ - │  Ready to build something awesome?\n  ╰───────╯`,
    `  ╭───────╮  Aca:\n  │ > ◡ < │  Ready to build something awesome?\n  ╰───────╯`
  ];

  console.log("");
  console.log(frames[0]);
  let i = 1;
  const interval = setInterval(() => {
    process.stdout.write('\x1B[3A\x1B[0J'); 
    console.log(frames[i % frames.length]);
    i++;
  }, 250);

  await new Promise((resolve) => setTimeout(resolve, 2500));
  clearInterval(interval);
  process.stdout.write('\x1B[3A\x1B[0J'); 
  console.log(frames[0] + "\n");

  intro(chalk.bgCyan(chalk.black(" 🚀 CLI START ")));

  const projectName = await text({
    message: "What is the name of your project?",
    initialValue: "project-name",
    validate: (value) => {
      if (value.trim() === "") return "Project name cannot be empty.";
      if (!/^[a-z0-9-_]+$/.test(value))
        return "Project name can only contain lowercase letters, numbers, dashes, and underscores.";
      return;
    },
  });
  if (isCancel(projectName)) { cancel("Operation cancelled."); process.exit(0); }

  const appType = await select({
    message: "Are you building an Application or a WordPress project?",
    options: [
      { label: "Application", value: "application" },
      { label: "WordPress", value: "wordpress" },
    ],
  });
  if (isCancel(appType)) { cancel("Operation cancelled."); process.exit(0); }

  let framework = null;
  let useLaravel = false;
  let wpType = null;
  let projectType = null;

  if (appType === "application") {
    framework = await select({
      message: "Which frontend framework do you want to use?",
      options: [
        { label: "React (Vite)", value: "react" },
        { label: "Next.js", value: "nextjs" },
      ],
    });
    if (isCancel(framework)) { cancel("Operation cancelled."); process.exit(0); }
    
    useLaravel = await confirm({
      message: "Do you want to add Laravel as a backend API?",
      initialValue: false,
    });
    if (isCancel(useLaravel)) { cancel("Operation cancelled."); process.exit(0); }
    
    projectType = framework;
  } else {
    wpType = await select({
      message: "Which WordPress project setup do you need?",
      options: [
        { label: "Standard Theme", value: "wp-theme" },
        { label: "WordPress + WooCommerce", value: "wp-woo" },
        { label: "WordPress + React", value: "wp-react" },
      ],
    });
    if (isCancel(wpType)) { cancel("Operation cancelled."); process.exit(0); }
    
    projectType = wpType;
  }

  const environment = await select({
    message: "Which local environment do you prefer?",
    options: [
      { label: "Docker (docker-compose.yaml)", value: "docker" },
      { label: "Lando (.lando.yml)", value: "lando" },
    ],
  });
  if (isCancel(environment)) { cancel("Operation cancelled."); process.exit(0); }

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

  const s = spinner();
  s.start("Scaffolding your project...");

  const targetDir = path.join(process.cwd(), projectName);

  try {
    if (await fs.pathExists(targetDir)) {
      s.stop("Directory exists!");
      cancel(chalk.red(`Directory "${projectName}" already exists! Please choose a different name.`));
      process.exit(1);
    }

    await fs.ensureDir(targetDir);

    await strategy.scaffold(targetDir, ctx);

    s.stop(`Project ${chalk.green(projectName)} successfully created!`);

    let nextSteps = `  cd ${projectName}\n`;
    if (environment === "docker") {
      nextSteps += `  docker-compose up -d\n`;
    } else {
      nextSteps += `  lando start\n`;
    }

    if (projectType === "nextjs" || projectType === "react") {
      nextSteps += `  npm install\n`;
      nextSteps += `  npm run dev`;
    }

    const doGitInit = await confirm({
      message: "Do you want to initialize a new Git repository?",
      initialValue: true
    });
    if (isCancel(doGitInit)) { cancel("Operation cancelled."); process.exit(0); }

    if (doGitInit) {
      try {
        execSync("git init", { cwd: targetDir, stdio: "ignore" });
        console.log(chalk.gray("│  Initialized empty Git repository."));
      } catch (err) {
        console.log(chalk.red("│  Failed to initialize git."));
      }
    }

    const sendToWp = await confirm({
      message: "Do you want to register this project on the Knowledge Base (Baza Znanja)?",
      initialValue: true
    });
    if (isCancel(sendToWp)) { cancel("Operation cancelled."); process.exit(0); }

    if (sendToWp) {
      const repoUrl = await text({ 
        message: "What is the Github Repository URL (SSH or HTTP)?",
        initialValue: "" 
      });
      if (isCancel(repoUrl)) { cancel("Operation cancelled."); process.exit(0); }
      
      const stagingUrl = await text({ 
        message: "What is the Staging URL?",
        initialValue: `https://${projectName}.popart.cloud`
      });
      if (isCancel(stagingUrl)) { cancel("Operation cancelled."); process.exit(0); }

      let defaultDevName = 'Unknown Developer';
      try {
        defaultDevName = execSync('git config user.name').toString().trim();
      } catch (e) {}

      const developerName = await text({
        message: "Developer Name:",
        initialValue: defaultDevName
      });
      if (isCancel(developerName)) { cancel("Operation cancelled."); process.exit(0); }

      const envChoice = await select({
        message: "Where is the Knowledge Base running?",
        options: [
          { label: "Local (http://localhost:8000)", value: "http://localhost:8000" },
          { label: "Staging (https://baza-znanja.popart.cloud)", value: "https://baza-znanja.popart.cloud" },
          { label: "Custom URL", value: "custom" }
        ]
      });
      if (isCancel(envChoice)) { cancel("Operation cancelled."); process.exit(0); }

      let wpSiteUrl = envChoice;
      if (envChoice === "custom") {
        wpSiteUrl = await text({
          message: "Enter the Base URL of the Knowledge Base:"
        });
        if (isCancel(wpSiteUrl)) { cancel("Operation cancelled."); process.exit(0); }
      }

      let basicAuthUser = process.env.WP_BASIC_AUTH_USER || "";
      let basicAuthPass = process.env.WP_BASIC_AUTH_PASS || "";
      
      const spinnerWp = spinner();
      spinnerWp.start("Registering project on Knowledge Base...");
      try {
        const post = await createProjectPost({
          wpSiteUrl,
          developerName,
          projectName,
          repoUrl,
          stagingUrl,
          basicAuthUser,
          basicAuthPass
        });
        spinnerWp.stop(chalk.green(`Project registered! Post ID: ${post.id}`));
      } catch(err) {
        spinnerWp.stop(chalk.red("Failed to register project on Knowledge Base."));
        console.log(chalk.red(`│  ${err.message}`));
      }
    }

    outro(
      `Next steps:\n${nextSteps}\n\n${chalk.cyan("Happy coding!")}`
    );

  } catch (error) {
    if (typeof s !== 'undefined' && typeof s.stop === 'function') s.stop(chalk.red("An error occurred."));
    cancel("Setup failed.");
    console.error(error);
    process.exit(1);
  }
}

run();
