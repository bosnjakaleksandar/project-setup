# =================================================================== #
# Wordpress - ignore core, configuration, examples, uploads and logs. #
# =================================================================== #

# -------------------------------------- #
# Core                                   #
# -------------------------------------- #

/wp-admin/
/wp-content/index.php
/wp-content/languages
/wp-content/plugins/index.php
/wp-content/themes/index.php
/wp-includes/
vendor
node_modules
/index.php
/license.txt
/readme.html
/wp-*.php
/xmlrpc.php

# -------------------------------------- #
# IDE / EDITOR                           #
# -------------------------------------- #

.vscode/
.idea/
*.sublime-project
*.sublime-workspace
start.sh

# -------------------------------------- #
# OS Files                               #
# -------------------------------------- #

.DS_Store
Thumbs.db
*.swp
*.swo
*.tmp

# -------------------------------------- #
# SQL                                    #
# -------------------------------------- #

*.sql

# -------------------------------------- #
# Themes                                 #
# -------------------------------------- #

/wp-content/themes/twenty*/

# -------------------------------------- #
# Plugins                                #
# -------------------------------------- #

/wp-content/plugins/
/wp-content/plugins/hello.php

# -------------------------------------- #
# Uploads                                #
# -------------------------------------- #

/wp-content/uploads/

# -------------------------------------- #
# Log files                              #
# -------------------------------------- #

*.log

# -------------------------------------- #
# Others                                 #
# -------------------------------------- #

upgrade
upgrade-temp-backup
/.htaccess
/wp-cli
wp.bat
dist
