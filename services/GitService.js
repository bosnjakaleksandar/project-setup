import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default class GitService {
  static async getGitignore(type) {
    let templateName = type;
    if (type === "wp-existing") templateName = "wordpress";
    if (type === "react" || type === "nextjs") templateName = "app";

    const templatePath = path.join(
      __dirname,
      "..",
      "templates",
      "gitignore",
      `${templateName}.gitignore.tpl`,
    );

    try {
      if (await fs.pathExists(templatePath)) {
        return await fs.readFile(templatePath, "utf-8");
      }
    } catch (e) {
      // Fallback or default content if template missing
    }

    return `# Default gitignore\nnode_modules/\n*.log\n.DS_Store\n`;
  }

  static async scaffoldGitignore(targetDir, type) {
    const content = await this.getGitignore(type);
    await fs.writeFile(path.join(targetDir, ".gitignore"), content);
  }
}
