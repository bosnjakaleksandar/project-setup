# Project Setup CLI

A Command Line Interface tool for automatically scaffolding projects. It supports **Next.js**, **React**, **WordPress Theme**, and **WordPress + WooCommerce** installations, while automatically generating the required local development environment config for **Docker** or **Lando**.

## 📌 Prerequisites

Before running this tool, you must have the following installed on your machine:
1. **Node.js and npm** (v18 or newer recommended) - [Download here](https://nodejs.org/en)
2. **Docker** or **Lando** (Depending on which environment you choose for local development)

## 🚀 Installation (Windows, Mac, Linux)

This CLI tool is designed to be installed globally on your machine so you can scaffold projects from **any directory**. The installation process is identical across operating systems.

### Step 1: Navigate to the CLI source directory
Open your terminal (`Terminal` on Mac/Linux or `Command Prompt` / `PowerShell` / `Git Bash` on Windows).
Navigate to the directory where this CLI code is located (where `package.json` and `index.js` live).

For example:
```bash
cd /path/to/folder/project-setup
```

*(On Windows, you might use a path like `cd C:\Users\Name\Projects\project-setup`)*

### Step 2: Enable the command globally (NPM Link)
Simply run the following command while inside the tool's directory:
```bash
npm link
```
**This will install any necessary dependencies and create a global alias ("shortcut") for the `create-project` command on your operating system.**

*(Note: If you get an EACCES permission error on Mac or Linux, try `sudo npm link`, though ensuring a Node version manager like NVM is used usually resolves permission issues natively).*

## 💻 Usage

Once linked, you no longer need to be inside the tool's directory. Navigate to any empty folder where you want to create a new project and type:

```bash
create-project
```

An interactive menu will guide you through:

1. **What is the name of your project?** - Folder and project name (lowercase, numbers, dashes only).
2. **Which type of project do you want to create?**
   - *Next.js Theme* - Scaffolds a modern Next.js application.
   - *React Theme* - Scaffolds a classic React SPA.
   - *WordPress Theme* - Generates basic WP files (or prompts for a Git repo URL to clone). Defaults to pulling the SSH template [Popart Theme](git@github.com:popart-studio/popart-tema.git).
   - *WordPress + WooCommerce* - Same as above, but with WooCommerce tags and scripts. Default theme clone is intentionally omitted.
3. **Which local environment do you prefer?** - Generates either a `docker-compose.yml` or a `.lando.yml`.
4. **Choose MySQL version & WordPress version** *(WP Only)*
5. **Git template URL** *(WP Only)* - Leave empty for standard boilerplate files, or enter an SSH/HTTPS Git URL.

### And then...
Once inputs are gathered, the CLI tool generates the project folder and configures your Docker/Lando/Node/PHP specifications. 

All that's left is to enter the newly generated folder:
```bash
cd <your-project-name>
```
And start your containers using `docker-compose up -d`, `lando start`.
