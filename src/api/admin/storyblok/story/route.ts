import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import StoryblokModuleService from "../../../../modules/storyblok/service";
import { STORYBLOK_MODULE } from "../../../../modules/storyblok";
import { ListSbProductsOutput } from "./validators";

export const GET = async (req: MedusaRequest, res: MedusaResponse<ListSbProductsOutput>) => {
  const container = req.scope;

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const sbModuleService = container.resolve<StoryblokModuleService>(STORYBLOK_MODULE);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data: products, metadata: { count, take, skip } = { count: 0, take: 20, skip: 0 } } = await query.graph({
    entity: "product",
    ...req.queryConfig,
  });

  if (!products || products.length === 0) {
    logger.warn("No product IDs provided for listing product stories");
    return res.status(200).json({ products: [], count: 0, limit: take, offset: skip });
  }

  try {
    const stories = await sbModuleService.listProductsStories({ products_ids: products.map((p) => p.id).join(",") });

    const result = products.map((product) => {
      const story = stories.find((s) => s.content.medusaProductId === product.id);
      return {
        id: product.id,
        name: product.title,
        handle: product.handle,
        storyblok_editor_url: story ? sbModuleService.getSbStoryEditorUrl({ id: story.id }) : null,
      };
    });

    return res.status(200).json({ products: result, count, limit: take, offset: skip });
  } catch (err) {
    logger.error("🔥 Failed to list product stories", err);
    return res.status(500).end();
  }
};
