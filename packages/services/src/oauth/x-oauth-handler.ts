export interface XOauthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface XOauthCallbackPayload {
  code: string;
  state: string;
}

export interface XOauthHandler {
  getAuthorizationUrl(userId: string, guildId: string): Promise<string>;
  handleCallback(payload: XOauthCallbackPayload): Promise<XOauthTokens>;
}

export class StubXOauthHandler implements XOauthHandler {
  async getAuthorizationUrl(userId: string, guildId: string): Promise<string> {
    // TODO: plug into real Twitter OAuth 2.0 flow and persist PKCE verifier
    return `https://twitter.com/i/oauth2/authorize?state=${guildId}-${userId}`;
  }

  async handleCallback(payload: XOauthCallbackPayload): Promise<XOauthTokens> {
    // TODO: exchange code for tokens via official API and persist securely
    return {
      accessToken: `stub-access-token-for-${payload.state}`,
      refreshToken: undefined,
      expiresAt: undefined,
    };
  }
}
