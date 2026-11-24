/* Content collections, edited by hand or through Pages CMS (see .pages.yml).
   - team: one Markdown file per person in src/content/team/. Photos live in src/assets/team/ and are optimised at build. */
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { TEAM_GROUPS } from "./data/site";

const team = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/team" }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      /* leave empty until the title is confirmed */
      role: z.string().default(""),
      group: z.enum(TEAM_GROUPS),
      /* lower numbers show first within a group */
      order: z.number().default(100),
      photo: image().optional(),
      linkedin: z.string().url().optional().or(z.literal("")),
      scholar: z.string().url().optional().or(z.literal("")),
      /* any other profile (university page, personal site) */
      website: z.string().url().optional().or(z.literal("")),
      /* drafts show in `npm run dev` only, never on the live site */
      draft: z.boolean().default(false),
    }),
});

export const collections = { team };
