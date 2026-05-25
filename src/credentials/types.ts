export const CredentialKinds = ["ak", "sk", "oauth"] as const;

export type CredentialKind = (typeof CredentialKinds)[number];

export type StoredCredential = {
  kind: CredentialKind;
  token: string;
  refreshToken?: string;
  scopes: string[];
  expiresAt?: number;
  owner?: string;
};

export type CredentialSource = "flag" | "env" | "keytar" | "file";

export type ResolvedCredential = StoredCredential & {
  source: CredentialSource;
};

export function isCredentialKind(value: unknown): value is CredentialKind {
  return typeof value === "string" && CredentialKinds.includes(value as CredentialKind);
}
