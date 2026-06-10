// Seeds 18 built-in templates into data/templates/<id>/template.json
// All templates use email-safe HTML: <table>, inline styles, no JS, no external CSS.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("data/templates");

const TEMPLATES = [
  {
    id: "classic-business",
    name: "Classic Business",
    description: "Simple professional signature with name, title, contact details.",
    category: "business",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#222222;">
  <tr><td style="padding-bottom:4px;"><strong style="font-size:15px;color:#111111;">{{displayName}}</strong></td></tr>
  <tr><td style="padding-bottom:4px;color:#555555;">{{jobTitle}}{{#if department}} — {{department}}{{/if}}</td></tr>
  <tr><td style="padding-bottom:2px;"><strong>{{companyName}}</strong></td></tr>
  <tr><td style="padding-bottom:2px;"><a href="mailto:{{mail}}" style="color:#0a66c2;text-decoration:none;">{{mail}}</a></td></tr>
  {{#if mobilePhone}}<tr><td style="padding-bottom:2px;">Mobile: {{mobilePhone}}</td></tr>{{/if}}
  {{#if officeLocation}}<tr><td style="color:#888888;">{{officeLocation}}</td></tr>{{/if}}
</table>`,
    text: "{{displayName}}\n{{jobTitle}} | {{companyName}}\n{{mail}}\n{{mobilePhone | fallback:\"\"}}",
    required_tags: ["displayName", "jobTitle", "mail"],
    optional_tags: ["mobilePhone", "officeLocation", "department", "companyName"],
  },
  {
    id: "modern-compact",
    name: "Modern Compact",
    description: "Single-line dense layout for small footprints.",
    category: "business",
    html: `<div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:#333333;border-left:3px solid #0a66c2;padding:6px 0 6px 12px;">
  <strong style="color:#111111;">{{displayName}}</strong> · {{jobTitle}} · <strong>{{companyName}}</strong><br/>
  <a href="mailto:{{mail}}" style="color:#0a66c2;text-decoration:none;">{{mail}}</a>{{#if mobilePhone}} · {{mobilePhone}}{{/if}}
</div>`,
    text: "{{displayName}} · {{jobTitle}} · {{companyName}} · {{mail}}",
    required_tags: ["displayName", "jobTitle", "mail"],
    optional_tags: ["mobilePhone", "companyName"],
  },
  {
    id: "logo-left-text-right",
    name: "Logo Left / Text Right",
    description: "Two-column layout with a logo on the left and details on the right.",
    category: "business",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#222;">
  <tr>
    <td style="vertical-align:top;padding-right:14px;border-right:1px solid #dddddd;">
      <img src="https://via.placeholder.com/96x96.png?text=LOGO" width="96" height="96" alt="{{companyName}} logo" style="display:block;border:0;"/>
    </td>
    <td style="vertical-align:top;padding-left:14px;">
      <div style="font-size:15px;font-weight:bold;color:#111;">{{displayName}}</div>
      <div style="color:#555;padding:2px 0 6px;">{{jobTitle}}{{#if department}}, {{department}}{{/if}}</div>
      <div><strong>{{companyName}}</strong></div>
      <div><a href="mailto:{{mail}}" style="color:#0a66c2;text-decoration:none;">{{mail}}</a></div>
      {{#if mobilePhone}}<div>{{mobilePhone}}</div>{{/if}}
    </td>
  </tr>
</table>`,
    text: "{{displayName}} | {{jobTitle}}\n{{companyName}}\n{{mail}}",
    required_tags: ["displayName", "jobTitle", "mail", "companyName"],
    optional_tags: ["mobilePhone", "department"],
    assets: ["company-logo"],
  },
  {
    id: "banner-campaign",
    name: "Banner Campaign",
    description: "Includes a top promotional banner image with click-through link.",
    category: "marketing",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#222;">
  <tr><td style="padding-bottom:10px;">
    <a href="https://example.com/spring"><img src="https://via.placeholder.com/468x80.png?text=Spring+Campaign" width="468" alt="Spring campaign" style="display:block;border:0;"/></a>
  </td></tr>
  <tr><td><strong style="font-size:15px;">{{displayName}}</strong> — {{jobTitle}}</td></tr>
  <tr><td>{{companyName}} · <a href="mailto:{{mail}}" style="color:#0a66c2;">{{mail}}</a>{{#if mobilePhone}} · {{mobilePhone}}{{/if}}</td></tr>
</table>`,
    text: "{{displayName}} — {{jobTitle}}\n{{companyName}}\n{{mail}}",
    required_tags: ["displayName", "jobTitle", "mail", "companyName"],
    optional_tags: ["mobilePhone"],
    assets: ["campaign-banner"],
  },
  {
    id: "minimal-legal",
    name: "Minimal + Legal Disclaimer",
    description: "Minimalist signature with a short legal disclaimer block.",
    category: "legal",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Georgia,serif;font-size:13px;color:#222;">
  <tr><td><strong>{{displayName}}</strong>{{#if jobTitle}} · {{jobTitle}}{{/if}}</td></tr>
  <tr><td style="color:#555;">{{companyName}}</td></tr>
  <tr><td style="padding-top:10px;font-size:11px;color:#888;line-height:1.4;">
    This email and any attachments are confidential and intended solely for the named recipient.
    If you received this in error, please notify the sender and delete the message.
  </td></tr>
</table>`,
    text: "{{displayName}} · {{jobTitle}}\n{{companyName}}",
    required_tags: ["displayName", "companyName"],
    optional_tags: ["jobTitle"],
  },
  {
    id: "sales-team",
    name: "Sales Team",
    description: "Sales-oriented signature with call-to-action and meeting link.",
    category: "sales",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#222;">
  <tr><td><strong style="font-size:15px;color:#111;">{{displayName}}</strong></td></tr>
  <tr><td style="color:#555;padding-bottom:6px;">{{jobTitle}} · {{companyName}}</td></tr>
  <tr><td>📞 {{mobilePhone | fallback:"—"}} · ✉️ <a href="mailto:{{mail}}" style="color:#0a66c2;">{{mail}}</a></td></tr>
  <tr><td style="padding-top:8px;">
    <a href="https://example.com/book" style="background:#0a66c2;color:#ffffff;padding:6px 12px;border-radius:3px;text-decoration:none;display:inline-block;">📅 Book a meeting</a>
  </td></tr>
</table>`,
    text: "{{displayName}} | {{jobTitle}}\n{{companyName}} · {{mail}}\nBook a meeting: https://example.com/book",
    required_tags: ["displayName", "jobTitle", "mail", "companyName"],
    optional_tags: ["mobilePhone"],
  },
  {
    id: "support-team",
    name: "Support Team",
    description: "Customer support signature with helpdesk URL and SLA reminder.",
    category: "support",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#222;">
  <tr><td><strong style="font-size:14px;">{{displayName}}</strong> — {{jobTitle}}</td></tr>
  <tr><td>{{companyName}} · Customer Support</td></tr>
  <tr><td style="padding:6px 0;">
    🎫 <a href="https://support.example.com" style="color:#0a66c2;">support.example.com</a> ·
    ⏰ Mon–Fri 9:00–18:00 CET
  </td></tr>
  <tr><td style="font-size:11px;color:#888;">Please keep the ticket reference in your reply so we can help you faster.</td></tr>
</table>`,
    text: "{{displayName}} — {{jobTitle}}\n{{companyName}} · support@example.com",
    required_tags: ["displayName", "jobTitle", "companyName"],
    optional_tags: [],
  },
  {
    id: "executive",
    name: "Executive Signature",
    description: "Formal executive signature with serif fonts and address block.",
    category: "executive",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Georgia,'Times New Roman',serif;font-size:13px;color:#222;">
  <tr><td style="font-size:17px;font-weight:bold;color:#111;letter-spacing:0.5px;">{{displayName}}</td></tr>
  <tr><td style="font-style:italic;color:#555;padding-bottom:6px;">{{jobTitle}}</td></tr>
  <tr><td><strong>{{companyName}}</strong></td></tr>
  {{#if streetAddress}}<tr><td>{{streetAddress}}, {{postalCode}} {{city}}, {{country}}</td></tr>{{/if}}
  <tr><td><a href="mailto:{{mail}}" style="color:#0a66c2;">{{mail}}</a>{{#if mobilePhone}} · {{mobilePhone}}{{/if}}</td></tr>
</table>`,
    text: "{{displayName}}\n{{jobTitle}}\n{{companyName}}\n{{mail}}",
    required_tags: ["displayName", "jobTitle", "mail", "companyName"],
    optional_tags: ["mobilePhone", "streetAddress", "postalCode", "city", "country"],
  },
  {
    id: "event-promotion",
    name: "Event Promotion",
    description: "Highlights an upcoming event with date, location, registration link.",
    category: "marketing",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#222;">
  <tr><td style="padding-bottom:8px;">
    <table cellpadding="8" cellspacing="0" border="0" bgcolor="#fff8e1" style="border-left:4px solid #f59e0b;">
      <tr><td style="font-size:12px;color:#92400e;">
        🎟️ <strong>Meet us at TechConf 2026</strong> — June 12–13, Zurich. <a href="https://example.com/event" style="color:#92400e;">Register</a>
      </td></tr>
    </table>
  </td></tr>
  <tr><td><strong>{{displayName}}</strong> · {{jobTitle}}</td></tr>
  <tr><td>{{companyName}} · <a href="mailto:{{mail}}" style="color:#0a66c2;">{{mail}}</a></td></tr>
</table>`,
    text: "{{displayName}} · {{jobTitle}}\n{{companyName}} · {{mail}}\nJoin us at TechConf 2026.",
    required_tags: ["displayName", "jobTitle", "mail", "companyName"],
    optional_tags: [],
  },
  {
    id: "plain-text-only",
    name: "Plain Text Only",
    description: "No HTML formatting — useful for compliance-heavy or mobile-first orgs.",
    category: "minimal",
    html: `<div style="font-family:Consolas,Menlo,monospace;font-size:13px;color:#222;white-space:pre-line;">{{displayName}}
{{jobTitle}} | {{companyName}}
{{mail}}{{#if mobilePhone}}
{{mobilePhone}}{{/if}}</div>`,
    text: "{{displayName}}\n{{jobTitle}} | {{companyName}}\n{{mail}}\n{{mobilePhone | fallback:\"\"}}",
    required_tags: ["displayName", "jobTitle", "mail", "companyName"],
    optional_tags: ["mobilePhone"],
  },
  {
    id: "two-column-card",
    name: "Two-Column Card",
    description: "Card-style layout with contact details in two columns.",
    category: "business",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,sans-serif;font-size:13px;color:#222;border:1px solid #e5e7eb;padding:10px;border-radius:4px;">
  <tr>
    <td style="vertical-align:top;padding-right:18px;">
      <div style="font-size:15px;font-weight:bold;color:#111;">{{displayName}}</div>
      <div style="color:#555;">{{jobTitle}}</div>
      <div style="color:#555;">{{department}}</div>
    </td>
    <td style="vertical-align:top;border-left:1px solid #e5e7eb;padding-left:18px;">
      <div><strong>{{companyName}}</strong></div>
      <div><a href="mailto:{{mail}}" style="color:#0a66c2;">{{mail}}</a></div>
      {{#if mobilePhone}}<div>{{mobilePhone}}</div>{{/if}}
      {{#if officeLocation}}<div style="color:#888;">{{officeLocation}}</div>{{/if}}
    </td>
  </tr>
</table>`,
    text: "{{displayName}} · {{jobTitle}}\n{{companyName}} · {{mail}}",
    required_tags: ["displayName", "jobTitle", "mail", "companyName"],
    optional_tags: ["mobilePhone", "department", "officeLocation"],
  },
  {
    id: "centered-minimal",
    name: "Centered Minimal",
    description: "Centered single-column layout — good for newsletters and personal-style emails.",
    category: "minimal",
    html: `<table cellpadding="0" cellspacing="0" border="0" align="center" style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#222;text-align:center;">
  <tr><td align="center"><strong style="font-size:15px;">{{displayName}}</strong></td></tr>
  <tr><td align="center" style="color:#555;">{{jobTitle}} · {{companyName}}</td></tr>
  <tr><td align="center"><a href="mailto:{{mail}}" style="color:#0a66c2;text-decoration:none;">{{mail}}</a></td></tr>
</table>`,
    text: "{{displayName}} · {{jobTitle}} · {{companyName}} · {{mail}}",
    required_tags: ["displayName", "jobTitle", "mail", "companyName"],
    optional_tags: [],
  },
  {
    id: "social-icons-row",
    name: "Social Icons Row",
    description: "Signature with a row of social media icons (LinkedIn, X, GitHub).",
    category: "marketing",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,sans-serif;font-size:13px;color:#222;">
  <tr><td><strong>{{displayName}}</strong> — {{jobTitle}}</td></tr>
  <tr><td>{{companyName}} · <a href="mailto:{{mail}}" style="color:#0a66c2;">{{mail}}</a></td></tr>
  <tr><td style="padding-top:6px;">
    <a href="https://linkedin.com/in/example" style="display:inline-block;margin-right:6px;"><img src="https://cdn.simpleicons.org/linkedin/0a66c2" width="18" height="18" alt="LinkedIn" style="border:0;display:inline;"/></a>
    <a href="https://x.com/example" style="display:inline-block;margin-right:6px;"><img src="https://cdn.simpleicons.org/x/000000" width="18" height="18" alt="X" style="border:0;display:inline;"/></a>
    <a href="https://github.com/example" style="display:inline-block;"><img src="https://cdn.simpleicons.org/github/181717" width="18" height="18" alt="GitHub" style="border:0;display:inline;"/></a>
  </td></tr>
</table>`,
    text: "{{displayName}} — {{jobTitle}}\n{{companyName}} · {{mail}}",
    required_tags: ["displayName", "jobTitle", "mail", "companyName"],
    optional_tags: [],
  },
  {
    id: "legal-disclaimer-heavy",
    name: "Legal Disclaimer Heavy",
    description: "Long compliance and confidentiality disclaimer for regulated industries.",
    category: "legal",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,sans-serif;font-size:13px;color:#222;">
  <tr><td><strong>{{displayName}}</strong> · {{jobTitle}}</td></tr>
  <tr><td>{{companyName}} · <a href="mailto:{{mail}}" style="color:#0a66c2;">{{mail}}</a></td></tr>
  <tr><td style="padding-top:12px;font-size:10.5px;color:#777;line-height:1.45;">
    <strong>Confidentiality notice:</strong> This message and any attachments are confidential, may be privileged, and are intended solely for the addressee. If you have received this email in error, please notify the sender immediately and delete all copies. Any unauthorised use, copying, or disclosure is strictly prohibited.<br/>
    <strong>Regulatory:</strong> {{companyName}} is registered in {{country | fallback:"Switzerland"}}. Email is not a secure channel; please do not send sensitive personal data.
  </td></tr>
</table>`,
    text: "{{displayName}} · {{jobTitle}}\n{{companyName}}\nConfidential — see footer.",
    required_tags: ["displayName", "jobTitle", "mail", "companyName"],
    optional_tags: ["country"],
  },
  {
    id: "consultant-rates",
    name: "Consultant / Rates",
    description: "For independent consultants — includes hourly rate and availability tag.",
    category: "freelance",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#222;">
  <tr><td><strong style="font-size:15px;">{{displayName}}</strong></td></tr>
  <tr><td style="color:#555;">{{jobTitle}} · {{companyName}}</td></tr>
  <tr><td><a href="mailto:{{mail}}" style="color:#0a66c2;">{{mail}}</a>{{#if mobilePhone}} · {{mobilePhone}}{{/if}}</td></tr>
  <tr><td style="padding-top:6px;">
    <span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:10px;font-size:11px;">Available for projects</span>
    <span style="background:#eef2ff;color:#3730a3;padding:2px 8px;border-radius:10px;font-size:11px;margin-left:4px;">CHF 180/h</span>
  </td></tr>
</table>`,
    text: "{{displayName}} · {{jobTitle}}\n{{companyName}} · {{mail}}",
    required_tags: ["displayName", "jobTitle", "mail", "companyName"],
    optional_tags: ["mobilePhone"],
  },
  {
    id: "startup-founder",
    name: "Startup Founder",
    description: "Bold, opinionated layout with company tagline and product link.",
    category: "startup",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:'Inter',Arial,sans-serif;font-size:13px;color:#111;">
  <tr><td><strong style="font-size:16px;">{{displayName}}</strong> — {{jobTitle}}</td></tr>
  <tr><td style="color:#555;padding-bottom:4px;">{{companyName}} · "Software that ships itself."</td></tr>
  <tr><td><a href="https://example.com" style="color:#dc2626;font-weight:bold;text-decoration:none;">→ try the product</a></td></tr>
  <tr><td style="padding-top:4px;color:#444;"><a href="mailto:{{mail}}" style="color:#111;">{{mail}}</a></td></tr>
</table>`,
    text: "{{displayName}} — {{jobTitle}}\n{{companyName}}\n{{mail}}",
    required_tags: ["displayName", "jobTitle", "mail", "companyName"],
    optional_tags: [],
  },
  {
    id: "nonprofit",
    name: "Non-profit / NGO",
    description: "Friendly signature including a donation call-to-action.",
    category: "nonprofit",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,sans-serif;font-size:13px;color:#222;">
  <tr><td><strong>{{displayName}}</strong></td></tr>
  <tr><td style="color:#555;">{{jobTitle}} · {{companyName}}</td></tr>
  <tr><td><a href="mailto:{{mail}}" style="color:#0a66c2;">{{mail}}</a></td></tr>
  <tr><td style="padding-top:8px;">
    <a href="https://example.org/donate" style="background:#16a34a;color:#fff;padding:6px 12px;border-radius:3px;text-decoration:none;display:inline-block;">💚 Donate</a>
  </td></tr>
  <tr><td style="padding-top:6px;font-size:11px;color:#888;">Registered charity · Tax ID 00-0000000</td></tr>
</table>`,
    text: "{{displayName}} · {{jobTitle}}\n{{companyName}} · {{mail}}",
    required_tags: ["displayName", "jobTitle", "mail", "companyName"],
    optional_tags: [],
  },
  {
    id: "academic",
    name: "Academic / University",
    description: "Faculty signature with department and office hours.",
    category: "academic",
    html: `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Cambria,Georgia,serif;font-size:13px;color:#222;">
  <tr><td><strong>{{displayName}}, PhD</strong></td></tr>
  <tr><td style="color:#555;">{{jobTitle}} · {{department}}</td></tr>
  <tr><td><strong>{{companyName}}</strong></td></tr>
  <tr><td><a href="mailto:{{mail}}" style="color:#7f1d1d;">{{mail}}</a></td></tr>
  <tr><td style="padding-top:6px;font-size:11px;color:#666;">Office hours: Tue 14:00–16:00 · Room 4.12</td></tr>
</table>`,
    text: "{{displayName}}, PhD\n{{jobTitle}} · {{department}}\n{{companyName}} · {{mail}}",
    required_tags: ["displayName", "jobTitle", "department", "companyName", "mail"],
    optional_tags: [],
  },
];

for (const t of TEMPLATES) {
  const dir = path.join(ROOT, t.id);
  fs.mkdirSync(dir, { recursive: true });
  const json = {
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    html: t.html,
    text: t.text,
    required_tags: t.required_tags,
    optional_tags: t.optional_tags,
    assets: t.assets || [],
  };
  fs.writeFileSync(path.join(dir, "template.json"), JSON.stringify(json, null, 2));
  fs.writeFileSync(path.join(dir, "template.html"), t.html);
}
console.log(`Seeded ${TEMPLATES.length} templates into ${ROOT}`);
