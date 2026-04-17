# Project Setup CLI

A Command Line Interface tool for automatically scaffolding projects. It supports **Next.js**, **React**, **WordPress**, **WordPress + WooCommerce**, **WordPress + React** installations, while automatically generating the required local development environment config for **Docker** or **Lando**.

## 📌 Prerequisites

Before running this tool, you must have the following installed on your machine:

1. **Node.js and npm** (v18 or newer recommended) - [Download here](https://nodejs.org/en)
2. **Docker** or **Lando** (Depending on which environment you choose for local development)

## 🚀 Installation (Mac, Linux)

This CLI tool is designed to be installed globally on your machine so you can scaffold projects from **any directory**. The installation process is identical across operating systems.

### Step 1: Navigate to the CLI source directory

Open your terminal `Terminal` on Mac/Linux.
Navigate to the directory where this CLI code is located (where `package.json` and `index.js` live).

For example:

```bash
cd /path/to/folder/project-setup
```

### Step 2: Enable the command globally (NPM Link)

Simply run the following command while inside the tool's directory:

```bash
npm link
```

**This will install any necessary dependencies and create a global alias ("shortcut") for the `create-project` command on your operating system.**

_(Note: If you get an EACCES permission error on Mac or Linux, try `sudo npm link`, though ensuring a Node version manager like NVM is used usually resolves permission issues natively)._

## ⚙️ Configuration

You can customize the CLI behavior for your specific organization by creating a `.env` file in the root of the CLI directory (based on `.env.example`).

### Environment Variables

- `STAGING_SUFFIX`: Default domain suffix for staging environments.
- `STAGING_SSH_HOST`: SSH host for the staging environment.
- `KNOWLEDGE_BASE_URL`: The URL for the Knowledge Base registration.
- `WP_THEME_REPO`: Default GitHub repository URL for the starter theme.
- `WP_WOO_BRANCH`: Branch name for WooCommerce template.
- `WP_REACT_BRANCH`: Branch name for React template.

## 💻 Usage

Once linked, you no longer need to be inside the tool's directory. Navigate to any empty folder where you want to create or clone a project and type:

```bash
create-project
```

Upon starting, the CLI will ask: **What would you like to do?**
1. **Create a new project** (See "Scaffolding a New Project")
2. **Set up an existing WP project** (See "Existing Project Setup")

---

### 🏗️ Scaffolding a New Project

An interactive menu will guide you through:

1. **What is the name of your project?** - Folder and project name (lowercase, numbers, dashes only).
2. **What are you building?** - Choose the core architecture for your project: Application or WordPress.
   - **Application**
     - **Which framework do you want to use?** - Choose between **Next.js** (for modern SSR) or **React** (for a classic SPA).
     - **Do you want to add Laravel as the backend?** - Choose 'Yes' to scaffold a full-stack environment alongside your frontend.
   - **WordPress**
     - **Type of WordPress project:**
       - **Standard Theme** - Pulls the boilerplate SSH template `git@github.com:starter-theme.git` on the default branch.
       - **WordPress + WooCommerce** - Automatically checks out the `woocommerce` branch of the chosen repository.
       - **WordPress + React** - Automatically checks out the `react` branch of the chosen repository.
     - **Choose MySQL version**
     - **Choose WordPress version**
     - **Git template URL** - Leave empty for standard boilerplate files, or enter an SSH/HTTPS Git URL.
3. **Which local environment do you prefer?** - Generates either a `docker-compose.yaml` or a `.lando.yml` configuration for your chosen setup.

---

### 🔄 Existing Project Setup (Clone from Staging)

Use this option to pull an existing WordPress project from a dedicated staging server.

#### 🔑 Prerequisites
- Ensure the `STAGING_SSH_HOST` variable is set correctly in your `.env` file.
- You must have SSH access to the staging server.
- The staging server should have `rsync` and `mariadb-dump` / `mysqldump` available.

#### 🧪 Process:
1. **Project Name**: Enter the name of the project as it's defined on the staging server (it will be used for the local folder and SSH user).
2. **Credentials**: Supply the path to your SSH Private Key if not using the default `~/.ssh/id_rsa`.
3. **Staging URL**: The CLI will suggest a staging URL for search-replace based on `STAGING_SUFFIX`.
4. **Automated Steps**:
   - **File Syncing**: Uses `rsync` to pull `wp-content/uploads`, `plugins`, and `themes`.
   - **Database Migration**: Securely exports the remote database over SSH and downloads it.
   - **Git Linkage**: Automatically attempts to find and link the remote Git repository from the staging environment.
   - **Environment Launch**: Starts your chosen environment (Docker/Lando) and imports the data.
   - **Search-Replace**: Automatically flips URLs from staging to local (e.g., `https://project.staging` to `http://localhost:8080`).

---

### And then...

Once inputs are gathered, the CLI tool generates the project folder and configures your Docker/Lando/Node/PHP specifications.

All that's left is to enter the newly generated folder:

```bash
cd <your-project-name>
```

For **new projects**, you will need to start your containers manually:

```bash
docker-compose up -d
```

or

```bash
lando start
```

*(Note: For **existing projects**, the environment is started automatically during the setup process!)*
