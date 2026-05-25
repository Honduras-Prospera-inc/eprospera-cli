import type { CredentialKind } from "../credentials/types.js";

export type CommandScopeRequirement = {
  requiredScope?: string;
  oauthScope?: string;
  credentialTypes?: readonly CredentialKind[];
};

const commandScopes = {
  "entity.verify": {
    requiredScope: "agent:verify_rpn",
    credentialTypes: ["ak", "sk"],
  },
  "entity.search": {
    requiredScope: "agent:registry.search",
    credentialTypes: ["ak", "sk"],
  },
  "entity.get": {
    requiredScope: "agent:entity.read",
    credentialTypes: ["ak", "sk"],
  },
  "entity.documents": {
    requiredScope: "agent:entity.documents.read",
    credentialTypes: ["ak", "sk"],
  },
  "application.list": {
    requiredScope: "agent:entity.application.read",
    credentialTypes: ["ak", "sk"],
  },
  "application.create": {
    requiredScope: "agent:entity.application.create",
    credentialTypes: ["ak", "sk"],
  },
  "application.get": {
    requiredScope: "agent:entity.application.read",
    credentialTypes: ["ak", "sk"],
  },
  "application.pay": {
    requiredScope: "agent:entity.application.pay",
    credentialTypes: ["ak", "sk"],
  },
  "application.watch": {
    requiredScope: "agent:entity.application.read",
    credentialTypes: ["ak", "sk"],
  },
  "me.profile": {
    requiredScope: "agent:person.details.read",
    oauthScope: "eprospera:person.details.read",
    credentialTypes: ["ak", "oauth"],
  },
  "me.residency": {
    requiredScope: "agent:person.residency.read",
    oauthScope: "eprospera:person.residency.read",
    credentialTypes: ["ak", "oauth"],
  },
  "me.id-verification": {
    requiredScope: "agent:person.id_verification.read",
    oauthScope: "eprospera:person.id_verification.read",
    credentialTypes: ["ak", "oauth"],
  },
  "auth.login": {
    credentialTypes: ["ak", "sk"],
  },
  "auth.whoami": {
    credentialTypes: ["ak", "sk", "oauth"],
  },
  "auth.logout": {
    credentialTypes: ["ak", "sk", "oauth"],
  },
  "config.get": {},
  "config.set": {},
  "config.list": {},
  "config.unset": {},
  "completion.bash": {},
  "completion.zsh": {},
  "completion.fish": {},
  "completion.powershell": {},
  schema: {},
} as const satisfies Record<string, CommandScopeRequirement>;

export type CommandId = keyof typeof commandScopes;

export const COMMAND_SCOPES: Record<CommandId, CommandScopeRequirement> = commandScopes;

export function getCommandScope(commandId: string): CommandScopeRequirement | undefined {
  return COMMAND_SCOPES[commandId as CommandId];
}
