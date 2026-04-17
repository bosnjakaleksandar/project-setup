export default class BaseStrategy {
  constructor(envService) {
    this.envService = envService;
  }

  async askQuestions(ctx) {
    return ctx;
  }

  async scaffoldSrc(targetDir, ctx) {
    throw new Error("scaffoldSrc must be implemented");
  }

  getTemplateType() {
    throw new Error("getTemplateType must be implemented");
  }

  async scaffoldEnvironment(targetDir, ctx) {
    if (this.envService) {
      await this.envService.scaffold(targetDir, this.getTemplateType(), ctx);
    }
  }

  async scaffold(targetDir, ctx) {
    await this.scaffoldEnvironment(targetDir, ctx);
    await this.scaffoldSrc(targetDir, ctx);
  }
}
