# Project Setup CLI

A Command Line Interface tool for automatically scaffolding projects. It supports **Next.js**, **React**, **WordPress**, **WordPress + WooCommerce**, **WordPress + React** installations, while automatically generating the required local development environment config for **Docker** or **Lando**.

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

_(On Windows, you might use a path like `cd C:\Users\Name\Projects\project-setup`)_

### Step 2: Enable the command globally (NPM Link)

Simply run the following command while inside the tool's directory:

```bash
npm link
```

**This will install any necessary dependencies and create a global alias ("shortcut") for the `create-project` command on your operating system.**

_(Note: If you get an EACCES permission error on Mac or Linux, try `sudo npm link`, though ensuring a Node version manager like NVM is used usually resolves permission issues natively)._

## 💻 Usage

Once linked, you no longer need to be inside the tool's directory. Navigate to any empty folder where you want to create a new project and type:

```bash
create-project
```

An interactive menu will guide you through:

1. **What is the name of your project?** - Folder and project name (lowercase, numbers, dashes only).
2. **What are you building?** - Choose the core architecture for your project: Application or WordPress.
   * **Application**
     * **Which framework do you want to use?** - Choose between **Next.js** (for modern SSR) or **React** (for a classic SPA).
     * **Do you want to add Laravel as the backend?** - Choose 'Yes' to scaffold a full-stack environment alongside your frontend.
   * **WordPress**
     * **Type of WordPress project:**
       -  **Standard Theme** - Pulls the boilerplate SSH template `git@github.com:popart-studio/popart-tema.git` on the default branch.
       - **WordPress + WooCommerce** - Automatically checks out the `woocommerce` branch of the chosen repository.
       - **WordPress + React** - Automatically checks out the `react` branch of the chosen repository.  
     * **Choose MySQL version & WordPress version.**
     * **Git template URL** - Leave empty for standard boilerplate files, or enter an SSH/HTTPS Git URL.
3. **Which local environment do you prefer?** - Generates either a `docker-compose.yaml` or a `.lando.yml` configuration for your chosen setup.

### And then...

Once inputs are gathered, the CLI tool generates the project folder and configures your Docker/Lando/Node/PHP specifications.

All that's left is to enter the newly generated folder:

```bash
cd <your-project-name>
```

And start your containers using `docker-compose up -d` or `lando start`.
