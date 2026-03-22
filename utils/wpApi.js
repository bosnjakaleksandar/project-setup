/**
 * Creates a new 'project' post on a remote WordPress site (Knowledge Base).
 * 
 * @param {Object} options 
 * @param {string} options.wpSiteUrl - Base URL of the remote WP site (e.g. 'https://admin.yourdomain.com')
 * @param {string} options.projectName - The name of the generated project
 * @param {string} options.repoUrl - The Git repository URL
 * @param {string} options.stagingUrl - The Staging URL of the new project
 * @param {string} options.developerName - The developer who created the project
 */
export async function createProjectPost({ wpSiteUrl, developerName, projectName, repoUrl, stagingUrl }) {

  const content = `
    <!-- wp:paragraph -->
    <p><strong>Developer:</strong> ${developerName}</p>
    <!-- /wp:paragraph -->
    <!-- wp:paragraph -->
    <p><strong>Repository URL:</strong> <a href="${repoUrl}">${repoUrl}</a></p>
    <!-- /wp:paragraph -->
    <!-- wp:paragraph -->
    <p><strong>Staging URL:</strong> <a href="${stagingUrl}">${stagingUrl}</a></p>
    <!-- /wp:paragraph -->
  `;

  // Endpoint
  const apiUrl = `${wpSiteUrl.replace(/\/$/, '')}/wp-json/baza-znanja/v1/projects`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: projectName,
      content: content,
      status: 'publish'
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Failed to create project post: ${errorData.message || response.statusText}`);
  }

  const postData = await response.json();
  return postData;
}
