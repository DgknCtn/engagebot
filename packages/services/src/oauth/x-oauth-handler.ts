import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { getPrismaClient } from '../prisma/client.js';

export interface XOauthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType?: string;
  scope?: string;
}

export interface XOauthCallbackPayload {
  code: string;
  state: string;
}

export interface XOauthHandler {
  getAuthorizationUrl(userId: string, guildId: string): Promise<string>;
  handleCallback(payload: XOauthCallbackPayload): Promise<XOauthTokens>;
}

const TWITTER_AUTHORIZE_URL = 'https://twitter.com/i/oauth2/authorize';
const TWITTER_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const TWITTER_ME_URL = 'https://api.twitter.com/2/users/me';

const DEFAULT_SCOPES = ['tweet.read', 'users.read', 'like.read', 'offline.access'];
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const base64UrlEncode = (buffer: Buffer): string => {
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

const sha256 = (input: string): Buffer => {
  return createHash('sha256').update(input).digest();
};

type StateEntry = {
  userId: string;
  guildId: string;
  codeVerifier: string;
  createdAt: number;
};

export interface PrismaXOauthHandlerOptions {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes?: string[];
  httpClient?: typeof fetch;
  prisma?: PrismaClient;
}

export class PrismaXOauthHandler implements XOauthHandler {
  private readonly prisma: PrismaClient;
  private readonly clientId: string;
  private readonly clientSecret: string | null;
  private readonly redirectUri: string;
  private readonly scopes: string[];
  private readonly fetchImpl: typeof fetch;
  private readonly states = new Map<string, StateEntry>();

  constructor(options: PrismaXOauthHandlerOptions = {}) {
    this.prisma = options.prisma ?? getPrismaClient();

    this.clientId = options.clientId ?? process.env.X_CLIENT_ID ?? '';
    if (!this.clientId) {
      throw new Error('X_CLIENT_ID must be set to use PrismaXOauthHandler');
    }

    this.clientSecret = options.clientSecret ?? process.env.X_CLIENT_SECRET ?? null;

    this.redirectUri = options.redirectUri ?? process.env.X_REDIRECT_URI ?? '';
    if (!this.redirectUri) {
      throw new Error('X_REDIRECT_URI must be set to use PrismaXOauthHandler');
    }

    this.scopes = options.scopes ?? DEFAULT_SCOPES;
    this.fetchImpl = options.httpClient ?? fetch;
  }

  async getAuthorizationUrl(userId: string, guildId: string): Promise<string> {
    await this.ensureGuild(guildId);
    const guildMember = await this.ensureGuildMember(guildId, userId);

    const state = randomUUID();
    const codeVerifier = base64UrlEncode(randomBytes(32));
    const codeChallenge = base64UrlEncode(sha256(codeVerifier));

    this.cleanupStates();
    this.states.set(state, {
      userId,
      guildId,
      codeVerifier,
      createdAt: Date.now(),
    });

    await this.prisma.twitterLink.upsert({
      where: { guildMemberId: guildMember.id },
      create: {
        guildMemberId: guildMember.id,
        state,
        codeVerifier,
      },
      update: {
        state,
        codeVerifier,
      },
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return `${TWITTER_AUTHORIZE_URL}?${params.toString()}`;
  }

  async handleCallback(payload: XOauthCallbackPayload): Promise<XOauthTokens> {
    const stateEntry = await this.resolveState(payload.state);

    const tokens = await this.exchangeCodeForTokens(payload.code, stateEntry.codeVerifier);
    const profile = await this.fetchProfile(tokens.accessToken);

    await this.persistTokens({
      guildId: stateEntry.guildId,
      userId: stateEntry.userId,
      state: payload.state,
      tokens,
      profile,
    });

    this.states.delete(payload.state);

    return tokens;
  }

  private async ensureGuild(guildId: string): Promise<void> {
    await this.prisma.guild.upsert({
      where: { id: guildId },
      create: { id: guildId },
      update: {},
    });
  }

  private async ensureGuildMember(guildId: string, userId: string) {
    return this.prisma.guildMember.upsert({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      create: {
        guildId,
        userId,
      },
      update: {},
      select: { id: true },
    });
  }

  private cleanupStates(): void {
    const now = Date.now();
    for (const [state, entry] of this.states.entries()) {
      if (now - entry.createdAt > STATE_TTL_MS) {
        this.states.delete(state);
      }
    }
  }

  private async resolveState(state: string): Promise<StateEntry> {
    this.cleanupStates();

    const inMemory = this.states.get(state);
    if (inMemory) {
      return inMemory;
    }

    const twitterLink = await this.prisma.twitterLink.findFirst({
      where: { state },
      include: {
        guildMember: {
          select: {
            guildId: true,
            userId: true,
          },
        },
      },
    });

    if (!twitterLink || !twitterLink.codeVerifier || !twitterLink.guildMember) {
      throw new Error('OAuth state is invalid or expired. Please restart the linking process.');
    }

    const entry: StateEntry = {
      userId: twitterLink.guildMember.userId,
      guildId: twitterLink.guildMember.guildId,
      codeVerifier: twitterLink.codeVerifier,
      createdAt: Date.now(),
    };

    this.states.set(state, entry);
    return entry;
  }

  private async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<XOauthTokens> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      code_verifier: codeVerifier,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (this.clientSecret) {
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      headers.Authorization = `Basic ${credentials}`;
    }

    const response = await this.fetchImpl(TWITTER_TOKEN_URL, {
      method: 'POST',
      headers,
      body: params.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Twitter token exchange failed (${response.status}): ${errorBody}`);
    }

    const body = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
      scope?: string;
    };

    const expiresAt = typeof body.expires_in === 'number' ? new Date(Date.now() + body.expires_in * 1000) : undefined;

    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt,
      tokenType: body.token_type,
      scope: body.scope,
    };
  }

  private async fetchProfile(accessToken: string): Promise<{ id: string; username?: string }> {
    const response = await this.fetchImpl(TWITTER_ME_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Failed to fetch Twitter profile (${response.status}): ${errorBody}`);
    }

    const body = (await response.json()) as {
      data?: {
        id: string;
        username?: string;
      };
    };

    if (!body.data?.id) {
      throw new Error('Twitter profile response missing user id');
    }

    return {
      id: body.data.id,
      username: body.data.username,
    };
  }

  private async persistTokens(params: {
    guildId: string;
    userId: string;
    state: string;
    tokens: XOauthTokens;
    profile: { id: string; username?: string };
  }): Promise<void> {
    const guildMember = await this.ensureGuildMember(params.guildId, params.userId);

    await this.prisma.twitterLink.upsert({
      where: { guildMemberId: guildMember.id },
      create: {
        guildMemberId: guildMember.id,
        accessToken: params.tokens.accessToken,
        refreshToken: params.tokens.refreshToken,
        tokenType: params.tokens.tokenType ?? null,
        scope: params.tokens.scope ?? null,
        expiresAt: params.tokens.expiresAt ?? null,
        state: null,
        codeVerifier: null,
        twitterUserId: params.profile.id,
        twitterHandle: params.profile.username ?? null,
      },
      update: {
        accessToken: params.tokens.accessToken,
        refreshToken: params.tokens.refreshToken ?? null,
        tokenType: params.tokens.tokenType ?? null,
        scope: params.tokens.scope ?? null,
        expiresAt: params.tokens.expiresAt ?? null,
        state: null,
        codeVerifier: null,
        twitterUserId: params.profile.id,
        twitterHandle: params.profile.username ?? null,
      },
    });
  }
}

export class StubXOauthHandler implements XOauthHandler {
  async getAuthorizationUrl(userId: string, guildId: string): Promise<string> {
    void userId;
    void guildId;
    return 'https://twitter.com/i/oauth2/authorize';
  }

  async handleCallback(payload: XOauthCallbackPayload): Promise<XOauthTokens> {
    return {
      accessToken: `stub-access-token-for-${payload.state}`,
    };
  }
}
