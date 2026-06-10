import { z } from "zod";

export const ApplyToModeSchema = z.enum([
  "all_users",
  "test_users",
  "domain",
  "department",
  "group",
  "csv",
]);

export const ApplyToSchema = z.object({
  mode: ApplyToModeSchema,
  test_users_file: z.string().nullable().optional(),
  group_id: z.string().nullable().optional(),
  domain: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  csv_path: z.string().nullable().optional(),
});

export const SignatureSettingsSchema = z.object({
  deployment_mode: z.literal("exchange_transport_rule"),
  disclaimer_location: z.enum(["append", "prepend"]).default("append"),
  fallback_action: z.enum(["wrap", "ignore", "reject"]).default("wrap"),
  apply_to: ApplyToSchema,
});

export const AssetSchema = z.object({
  id: z.string(),
  type: z.enum(["image"]),
  path: z.string().nullable().optional(),
  public_url: z.string().url().nullable().optional(),
  alt: z.string().default(""),
});

export const SignatureSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-_]{0,63}$/, "id must be lowercase slug"),
  name: z.string().min(1),
  description: z.string().default(""),
  status: z.enum(["draft", "published"]).default("draft"),
  created_at: z.string(),
  updated_at: z.string(),
  current_version: z.string().nullable().optional(),
  editor: z.object({
    html: z.string().default(""),
    text: z.string().default(""),
  }),
  settings: SignatureSettingsSchema,
  assets: z.array(AssetSchema).default([]),
  dynamic_tags: z.array(z.string()).default([]),
});

export type Signature = z.infer<typeof SignatureSchema>;
export type SignatureSettings = z.infer<typeof SignatureSettingsSchema>;
export type Asset = z.infer<typeof AssetSchema>;

export const TemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  category: z.string().default("business"),
  html: z.string(),
  text: z.string(),
  required_tags: z.array(z.string()).default([]),
  optional_tags: z.array(z.string()).default([]),
  assets: z.array(z.string()).default([]),
});
export type Template = z.infer<typeof TemplateSchema>;

export const VersionMetadataSchema = z.object({
  version: z.string(),
  signature_id: z.string(),
  published_at: z.string(),
  published_by: z.string(),
  notes: z.string().default(""),
  hash: z.string(),
  deployment_status: z.enum(["not_deployed", "deployed", "rolled_back", "failed"]).default("not_deployed"),
});
export type VersionMetadata = z.infer<typeof VersionMetadataSchema>;

export interface SampleUser {
  displayName: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string;
  department?: string;
  companyName?: string;
  officeLocation?: string;
  mail: string;
  userPrincipalName?: string;
  businessPhones?: string[];
  mobilePhone?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  manager?: string;
  [key: string]: unknown;
}

export interface RenderedSignature {
  html: string;
  text: string;
  warnings: string[];
}

export interface DeploymentReport {
  deployment_id: string;
  signature_id: string;
  version: string;
  mode: "exchange_transport_rule";
  dry_run: boolean;
  target: { type: string; count: number; details?: unknown };
  exchange: {
    rule_name: string;
    operation: "set_or_create" | "disable" | "enable" | "remove" | "rollback";
    enabled: boolean;
  };
  validation: { errors: string[]; warnings: string[] };
  result: { status: "success" | "failed" | "skipped"; message: string };
  generated_at: string;
}
