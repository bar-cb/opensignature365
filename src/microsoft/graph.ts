import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
// Node 18+ provides fetch globally; Graph SDK uses it.

function envOrThrow(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env var: ${k}`);
  return v;
}

let cached: Client | null = null;

export function getGraphClient(): Client {
  if (cached) return cached;
  const tenantId = envOrThrow("MICROSOFT_TENANT_ID");
  const clientId = envOrThrow("MICROSOFT_CLIENT_ID");
  const clientSecret = envOrThrow("MICROSOFT_CLIENT_SECRET");
  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  cached = Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const token = await credential.getToken("https://graph.microsoft.com/.default");
        if (!token) throw new Error("Failed to acquire Microsoft Graph token.");
        return token.token;
      },
    },
  });
  return cached;
}

export interface GraphTestResult {
  ok: boolean;
  message: string;
  organization?: { displayName?: string; id?: string; verifiedDomains?: unknown };
}

export async function testGraphConnection(): Promise<GraphTestResult> {
  try {
    const client = getGraphClient();
    const org = await client.api("/organization").select("id,displayName,verifiedDomains").get();
    const first = org?.value?.[0];
    return {
      ok: true,
      message: `Connected to ${first?.displayName ?? "Microsoft Graph"}`,
      organization: first,
    };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

export async function listUsers(limit = 25): Promise<unknown[]> {
  const client = getGraphClient();
  const res = await client
    .api("/users")
    .select("id,displayName,jobTitle,department,mail,userPrincipalName,businessPhones,mobilePhone,officeLocation")
    .top(limit)
    .get();
  return res.value ?? [];
}

export async function getUser(upn: string): Promise<unknown> {
  const client = getGraphClient();
  return client
    .api(`/users/${encodeURIComponent(upn)}`)
    .select("id,displayName,givenName,surname,jobTitle,department,companyName,mail,userPrincipalName,businessPhones,mobilePhone,officeLocation,streetAddress,city,state,postalCode,country")
    .get();
}

export interface SendMailOptions {
  toUpn: string;
  fromUpn?: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendPreviewEmail(opts: SendMailOptions): Promise<void> {
  const client = getGraphClient();
  const sender = opts.fromUpn || process.env.PREVIEW_SENDER_UPN;
  if (!sender) throw new Error("PREVIEW_SENDER_UPN not set.");
  await client.api(`/users/${encodeURIComponent(sender)}/sendMail`).post({
    message: {
      subject: opts.subject,
      body: { contentType: "HTML", content: opts.html },
      toRecipients: [{ emailAddress: { address: opts.toUpn } }],
    },
    saveToSentItems: true,
  });
}
