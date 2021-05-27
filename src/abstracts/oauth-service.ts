import fs from "fs/promises";
import path from "path";
import { keysDir } from "../paths";

export abstract class OAuthService {
  protected abstract getName(): string;

  public abstract getAuthUrl(): string;
  public abstract initializeForAuthorization(): Promise<void>;
  public abstract getAccessToken(): Promise<string | null>;

  protected getCredentialsFilePath() {
    return path.join(keysDir, `oauth-${this.getName()}.json`);
  }

  protected async writeCredentials(tokens: any) {
    return fs.writeFile(this.getCredentialsFilePath(), JSON.stringify(tokens));
  }

  protected async getCredentials(): Promise<Record<string, any> | null> {
    if (await this.isAuthorized()) {
      const credentials = (await fs.readFile(this.getCredentialsFilePath())).toString();
      return JSON.parse(credentials);
    }
    return null;
  }

  protected async isAuthorized(): Promise<boolean> {
    const stat = await fs.stat(this.getCredentialsFilePath());
    return stat.isFile();
  }
}
