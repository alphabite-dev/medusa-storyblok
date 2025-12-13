import { z } from "zod";

export const storyblokWebhookInputSchema = z.object({
  text: z.string(),
  action: z.string(),
  space_id: z.number(),
  story_id: z.number(),
  full_slug: z.string(),
});

export type StoryblokWebhookInput = z.infer<typeof storyblokWebhookInputSchema>;
