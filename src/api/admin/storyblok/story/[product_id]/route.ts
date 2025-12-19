import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";
import StoryblokModuleService from "../../../../../modules/storyblok/service";
import { STORYBLOK_MODULE } from "../../../../../modules/storyblok";
import { createSbProductWorkflow, createSbProductVariantsWorkflow } from "../../../../../workflows";

export const GET = async (req: MedusaRequest<{ product_id: string }>, res: MedusaResponse) => {
  const container = req.scope;
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const sbModuleService = container.resolve<StoryblokModuleService>(STORYBLOK_MODULE);
  const { product_id } = req.params;

  try {
    const productStory = await sbModuleService.retrieveProductStory({
      productId: product_id,
    });

    if (!productStory) {
      logger.warn(`No product story found for product_id: ${product_id}`);
      return res.status(500).end();
    }

    return res.status(200).json({ storyblok_editor_url: sbModuleService.getSbStoryEditorUrl({ id: productStory.id }) });
  } catch (err) {
    logger.error("🔥 Failed to process update story webhook", err);
    return res.status(500).end();
  }
};

export const POST = async (req: MedusaRequest<{ product_id: string }>, res: MedusaResponse) => {
  const container = req.scope;
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const sbModuleService = container.resolve<StoryblokModuleService>(STORYBLOK_MODULE);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { product_id } = req.params;

  try {
    // Create product story
    const productStory = await createSbProductWorkflow.run({ container, input: { product_id } });

    // Get product variants
    const { data: product } = await query.graph({
      entity: "product",
      filters: { id: product_id },
      fields: ["id", "variants.id"],
    });

    // Sync variants if they exist
    if (product[0]?.variants && product[0].variants.length > 0) {
      await createSbProductVariantsWorkflow(container).run({
        input: {
          product_id: product_id,
          variant_ids: product[0].variants.map((v: any) => v.id),
        },
      });
    }

    return res
      .status(200)
      .json({ storyblok_editor_url: sbModuleService.getSbStoryEditorUrl({ id: productStory.result.data.id }) });
  } catch (err) {
    logger.error("🔥 Failed to create product story", err);
    return res.status(500).end();
  }
};
