import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";
import StoryblokModuleService from "../../../../../modules/storyblok/service";
import { STORYBLOK_MODULE } from "../../../../../modules/storyblok";

export const GET = async (req: MedusaRequest<{ product_id: string }>, res: MedusaResponse) => {
  const container = req.scope;
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const sbModuleService = container.resolve<StoryblokModuleService>(STORYBLOK_MODULE);
  const { product_id } = req.params;

  try {
    const productStory = await sbModuleService.retrieveProductStory({
      productId: product_id
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
