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
export async function createProjectPost({ wpSiteUrl, developerName, projectName, repoUrl, stagingUrl, basicAuthUser, basicAuthPass }) {

  // Endpoint
  const apiUrl = `${wpSiteUrl.replace(/\/$/, '')}/wp-json/baza-znanja/v1/projects`;

  const headers = {
    'Content-Type': 'application/json',
  };

  if (basicAuthUser && basicAuthPass) {
    const encodedCredentials = Buffer.from(`${basicAuthUser}:${basicAuthPass}`).toString('base64');
    headers['Authorization'] = `Basic ${encodedCredentials}`;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      title: projectName,
      status: 'publish',
      acf: {
        developer: developerName,
        repo_url: repoUrl,
        staging_url: stagingUrl
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Failed to create project post: ${errorData.message || response.statusText}`);
  }

  const postData = await response.json();
  return postData;
}
