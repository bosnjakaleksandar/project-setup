import { text, select, isCancel, cancel, confirm, spinner } from "@clack/prompts";
import chalk from "chalk";
import { execSync } from "child_process";
import { createProjectPost } from "../utils/wpApi.js";

export async function registerOnKnowledgeBase(ctx) {
  const sendToWp = await confirm({
    message: "Do you want to register this project on the Knowledge Base (Baza Znanja)?",
    initialValue: true,
  });
  if (isCancel(sendToWp)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  if (!sendToWp) return;

  const repoUrl = await text({
    message: "What is the Github Repository URL (SSH or HTTP)?",
    initialValue: ctx.stagingRepoUrl || "",
  });
  if (isCancel(repoUrl)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  const stagingUrl = await text({
    message: "What is the Staging URL?",
    initialValue: `https://${ctx.projectName}${process.env.STAGING_SUFFIX || ".staging"}`,
  });
  if (isCancel(stagingUrl)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  let defaultDevName = "Unknown Developer";
  try {
    defaultDevName = execSync("git config user.name").toString().trim();
  } catch (e) {}

  const developerName = await text({
    message: "Developer Name:",
    initialValue: defaultDevName,
  });
  if (isCancel(developerName)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  const envChoice = await select({
    message: "Where is the Knowledge Base running?",
    options: [
      {
        label: `Staging (${process.env.KNOWLEDGE_BASE_URL || "https://knowledge-base.staging"})`,
        value: process.env.KNOWLEDGE_BASE_URL || "https://knowledge-base.staging",
      },
      { label: "Custom URL", value: "custom" },
    ],
  });
  if (isCancel(envChoice)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  let wpSiteUrl = envChoice;
  if (envChoice === "custom") {
    wpSiteUrl = await text({
      message: "Enter the Base URL of the Knowledge Base:",
    });
    if (isCancel(wpSiteUrl)) {
      cancel("Operation cancelled.");
      process.exit(0);
    }
  }

  let basicAuthUser = process.env.WP_BASIC_AUTH_USER || "";
  let basicAuthPass = process.env.WP_BASIC_AUTH_PASS || "";

  const spinnerWp = spinner();
  spinnerWp.start("Registering project on Knowledge Base...");
  try {
    const post = await createProjectPost({
      wpSiteUrl,
      developerName,
      projectName: ctx.projectName,
      repoUrl,
      stagingUrl,
      basicAuthUser,
      basicAuthPass,
    });
    spinnerWp.stop(chalk.green(`Project registered! Post ID: ${post.id}`));
  } catch (err) {
    spinnerWp.stop(chalk.red("Failed to register project on Knowledge Base."));
    console.log(chalk.red(`│  ${err.message}`));
  }
}
