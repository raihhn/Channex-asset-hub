export type Capability =
  | "asset:read"
  | "request:create"
  | "request:approve"
  | "asset:operate"
  | "master-data:manage"
  | "report:read";

export type CurrentUser = {
  id: string;
  displayName: string;
  email: string;
  capabilities: readonly Capability[];
};

export type Session = {
  user: CurrentUser;
  source: "development" | "provider";
};
