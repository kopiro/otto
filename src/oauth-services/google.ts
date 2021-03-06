import { google } from "googleapis";
import { OAuthService } from "../abstracts/oauth-service";
import * as Server from "../stdlib/server";
import { OAuth2Client, Credentials } from "google-auth-library";
import config from "../config";

type OAuthConfig = { clientId: string; clientSecret: string; scopes: string[] };

export class GoogleOAuthService extends OAuthService {
  private oauth2Client: OAuth2Client;
  private _config: OAuthConfig;

  constructor(_config: OAuthConfig) {
    super();
    this._config = _config;
    // @ts-ignore
    this.oauth2Client = new google.auth.OAuth2(this._config.clientId, this._config.clientSecret, this.getRedirectUrl());
  }

  async getAccessToken(): Promise<string | null> {
    const credentials = (await this.getCredentials()) as Credentials | null;
    if (!credentials) return null;
    this.oauth2Client.setCredentials(credentials);
    return (await this.oauth2Client.getAccessToken()).token;
  }

  async initializeForAuthorization() {
    // @ts-ignore
    Server.routerOAuth.get("/google", async (req, res) => {
      try {
        const { tokens } = await this.oauth2Client.getToken(req.query.code.toString());
        this.writeCredentials(tokens);
        res.send("You can close this window now");
      } catch (err) {
        res.send(`Error: ${err.message}`);
      }
    });
  }

  getName() {
    return "google";
  }

  getRedirectUrl() {
    return `${Server.getDomain()}/oauth/google`;
  }

  getAuthUrl() {
    return this.oauth2Client.generateAuthUrl({
      access_type: "offline", // needed to receive the refresh_token
      prompt: "consent", // needed to always receive the refresh_token, not only 1st req
      scope: this._config.scopes,
    });
  }
}

let _instance: GoogleOAuthService;
export default (): GoogleOAuthService => {
  _instance = _instance || new GoogleOAuthService(config().oauth.google);
  return _instance;
};
