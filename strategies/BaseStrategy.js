export default class BaseStrategy {
  async askQuestions(ctx) {
    return ctx;
  }

  async scaffoldSrc(targetDir, ctx) {
    throw new Error('scaffoldSrc must be implemented');
  }

  async scaffoldEnvironment(targetDir, ctx) {
    throw new Error('scaffoldEnvironment must be implemented');
  }

  async scaffold(targetDir, ctx) {
    await this.scaffoldSrc(targetDir, ctx);
    await this.scaffoldEnvironment(targetDir, ctx);
  }
}
