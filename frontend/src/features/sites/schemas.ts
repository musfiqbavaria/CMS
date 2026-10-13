import { z } from "zod";

function looksLikeDomain(v: string): boolean {
  const host = v
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split("?")[0]
    .replace(/\.$/, "");
  return host.length > 0 && host.includes(".") && !/\s/.test(host);
}

export const siteSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
  domain: z
    .string()
    .trim()
    .min(1, "Domain is required")
    .max(255)
    .refine(looksLikeDomain, "Enter a valid domain, e.g. example.com"),
  type: z.enum(["connected", "built"]),
  integration_mode: z.enum(["connector", "proxy"]),
});

export type SiteSchemaValues = z.infer<typeof siteSchema>;
