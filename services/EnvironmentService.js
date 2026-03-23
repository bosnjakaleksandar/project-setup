export default class EnvironmentService {
  async scaffold(targetDir, type, options) {
    throw new Error("scaffold() not implemented");
  }

  async start(targetDir) {
    throw new Error("start() not implemented");
  }

  async importDb(targetDir, sqlFile) {
    throw new Error("importDb() not implemented");
  }

  async searchReplace(targetDir, from, to) {
    throw new Error("searchReplace() not implemented");
  }

  async runWpCommand(targetDir, command) {
    throw new Error("runWpCommand() not implemented");
  }

  async isDbReady(targetDir) {
    throw new Error("isDbReady() not implemented");
  }
}
