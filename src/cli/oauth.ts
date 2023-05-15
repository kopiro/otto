import "../boot";
import { OAuthService } from "../abstracts/oauth-service";
import googleOAuthService from "../oauth-services/google";
import * as Server from "../stdlib/server";

function getServiceClass(service: string): OAuthService | null {
  switch (service) {
    case "google":
      return googleOAuthService();
    default:
      return null;
  }
}

const argService = process.argv[2];
const serviceClass = getServiceClass(argService);
if (!serviceClass) {
  console.error(`Unrecognized service (${argService})`);
  process.exit(1);
}

Server.start().then(async () => {
  serviceClass.initializeForAuthorization().then(() => {
    const url = serviceClass.getAuthUrl();
    console.debug(`Please open this URL: ${url}`);
  });
});
