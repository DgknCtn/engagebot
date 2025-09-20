interface UserProfile {
  walletAddress?: string;
}

const profiles = new Map<string, UserProfile>();

export const setWalletAddress = (userId: string, address: string): void => {
  const profile = profiles.get(userId) ?? {};
  profiles.set(userId, { ...profile, walletAddress: address });
};

export const getWalletAddress = (userId: string): string | undefined => {
  return profiles.get(userId)?.walletAddress;
};
