import { defineMiddlewares, validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework";
import { ListSbProductsSchema } from "./admin/storyblok/story/validators";
import { createFindParams } from "@medusajs/medusa/api/utils/validators";
import { SbBulkSyncBodySchema } from "./admin/storyblok/bulk-sync/validators";

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/storyblok/story",
      method: "GET",
      middlewares: [
        validateAndTransformQuery(createFindParams(), { isList: true, defaults: ["id", "handle", "title"] }),
      ],
    },
    {
      matcher: "/admin/storyblok/bulk-sync",
      method: "POST",
      middlewares: [validateAndTransformBody(SbBulkSyncBodySchema)],
    },
  ],
});
