import { ContainerRegistrationKeys, promiseAll } from "@medusajs/utils";
import { createStep, StepResponse } from "@medusajs/workflows-sdk";
import { STORYBLOK_MODULE } from "../../../../modules/storyblok";
import StoryblokModuleService from "../../../../modules/storyblok/service";

export type CreateSbProductStepInput = {
  product_id: string;
};

export const createSbProductStep = createStep(
  {
    name: "create-sb-product",
  },
  async ({ product_id }: CreateSbProductStepInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const sb = container.resolve<StoryblokModuleService>(STORYBLOK_MODULE);

    logger.info("Syncing Sb with Medusa products...");

    const { data } = await query.graph({
      entity: "product",
      filters: { id: product_id },
      fields: ["id", "title", "handle", "thumbnail", "images.url"],
    });

    const product = data[0];

    const createdStory = await sb.createProductStory(product);

    return new StepResponse({ data: createdStory });
  }
);
