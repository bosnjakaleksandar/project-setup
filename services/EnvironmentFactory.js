import LandoService from "./LandoService.js";
import DockerComposeService from "./DockerComposeService.js";

export default class EnvironmentFactory {
  static getService(environment) {
    if (environment === "lando") {
      return new LandoService();
    }
    return new DockerComposeService();
  }
}
