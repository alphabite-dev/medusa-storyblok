import { z } from "zod";

export const ListSbProductsSchema = z.object({});

export type ListSbProductStories = z.infer<typeof ListSbProductsSchema>;

export const ListSbProductsOutputSchema = z.object({
  products: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      handle: z.string(),
      storyblok_editor_url: z.string().nullable(),
    })
  ),
  count: z.number(),
  limit: z.number(),
  offset: z.number(),
});

export type ListSbProductsOutput = z.infer<typeof ListSbProductsOutputSchema>;
