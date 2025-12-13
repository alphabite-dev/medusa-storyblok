import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { StoryblokWebhookInput } from "../validators";
import { ContainerRegistrationKeys, Modules } from "@medusajs/utils";
import { STORYBLOK_MODULE } from "../../../../../modules/storyblok";
import StoryblokModuleService from "../../../../../modules/storyblok/service";
import { deleteProductsWorkflow } from "@medusajs/core-flows";

export const POST = async (req: MedusaRequest<StoryblokWebhookInput>, res: MedusaResponse) => {
  const container = req.scope;
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const sbModuleService = container.resolve<StoryblokModuleService>(STORYBLOK_MODULE);
  const options = sbModuleService.getOptions();

  if (!options.deleteProductOnSbProductStoryDelete) {
    logger.info("❌ Delete Medusa Product on Sb Product Story Delete is disabled.");
    return res.status(200).end();
  }

  try {
    const { story_id, action } = req.body;

    if (action !== "deleted") {
      logger.info(`❌ Unexpected action: ${action} for story_id: ${story_id} at delete webhook endpoint.`);
      return res.status(200).end();
    }

    const productStory = await sbModuleService.retrieveProductStory({
      params: { by_ids: String(story_id) },
    });

    if (!productStory) {
      logger.warn(`No product story found for story_id: ${story_id}`);

      return res.status(500).end();
    }

    await deleteProductsWorkflow(container).run({
      input: {
        ids: [productStory.content.medusaProductId],
      },
    });

    logger.info(
      `✅ Deleted product ${productStory.content.medusaProductId} from story ${story_id}, slug: ${productStory.slug}`
    );
    return res.status(200).end();
  } catch (err) {
    logger.error("🔥 Failed to process delete story webhook", err);
    return res.status(500).end();
  }
};

export const AUTHENTICATE = false;
