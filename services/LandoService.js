import EnvironmentService from "./EnvironmentService.js";
import fs from "fs-extra";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { resolveTemplateName, resolveDbImage } from "../utils/templateMap.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default class LandoService extends EnvironmentService {
  async scaffold(targetDir, type, options) {
    const { projectName, mysqlVersion, tablePrefix } = options;
    const templateName = resolveTemplateName(type);

    const templatePath = path.join(
      __dirname,
      "..",
      "templates",
      "lando",
      `${templateName}.yaml.tpl`,
    );
    let content = await fs.readFile(templatePath, "utf-8");

    if (mysqlVersion) {
      content = content.replace(/{{DB_IMAGE}}/g, resolveDbImage(mysqlVersion));
    }

    const tablePrefixValue = tablePrefix || "wp_";
    content = content.replace(/{{TABLE_PREFIX}}/g, tablePrefixValue);

    content = content.replace(/{{PROJECT_NAME}}/g, projectName);

    await fs.writeFile(path.join(targetDir, ".lando.yml"), content);
  }

  async start(targetDir) {
    execSync("lando start", { stdio: "inherit", cwd: targetDir });
  }

  async importDb(targetDir, sqlFile) {
    execSync(`lando db-import ${sqlFile}`, {
      stdio: "inherit",
      cwd: targetDir,
    });
  }

  async searchReplace(targetDir, from, to) {
    execSync(`lando wp search-replace '${from}' '${to}'`, {
      stdio: "inherit",
      cwd: targetDir,
    });
  }

  async runWpCommand(targetDir, command) {
    execSync(`lando wp ${command}`, {
      stdio: "inherit",
      cwd: targetDir,
    });
  }

  async isDbReady(targetDir) {
    return true;
  }
}
