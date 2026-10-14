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

const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export const siteSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(255),
    domain: z.string().trim().max(255).optional().default(""),
    subdomain: z.string().trim().toLowerCase().max(63).optional().default(""),
    type: z.enum(["connected", "built"]),
    integration_mode: z.enum(["connector", "proxy"]),
  })
  .superRefine((v, ctx) => {
    const domain = (v.domain ?? "").trim();
    const subdomain = (v.subdomain ?? "").trim().toLowerCase();
    if (v.type === "connected") {
      if (!domain || !looksLikeDomain(domain)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["domain"],
          message: "Enter a valid domain, e.g. example.com",
        });
      }
      if (subdomain) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["subdomain"],
          message: "Free subdomains are only available for built sites.",
        });
      }
      return;
    }
    if (!domain && !subdomain) {
      // Built sites only reach here (connected returns above): the server
      // auto-allocates a free subdomain from the name, so empty is valid.
      return;
    }
    if (domain && subdomain) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["domain"],
        message: "Provide either a subdomain or a custom domain, not both.",
      });
      return;
    }
    if (domain && !looksLikeDomain(domain)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["domain"],
        message: "Enter a valid domain, e.g. example.com",
      });
    }
    if (subdomain && !SUBDOMAIN_RE.test(subdomain)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subdomain"],
        message: "Use lowercase letters, numbers and hyphens, e.g. myshop.",
      });
    }
  });

export type SiteSchemaValues = z.infer<typeof siteSchema>;
