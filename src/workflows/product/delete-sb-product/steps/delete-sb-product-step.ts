import { createStep, StepResponse } from "@medusajs/workflows-sdk";
import { STORYBLOK_MODULE } from "../../../../modules/storyblok";
import StoryblokModuleService from "../../../../modules/storyblok/service";

export type DeleteSbProductStepInput = {
  product_id: string;
};

export const deleteSbProductStep = createStep(
  {
    name: "delete-sb-product",
  },
  async ({ product_id }: DeleteSbProductStepInput, { container }) => {
    const logger = container.resolve("logger");
    const sbModuleService = container.resolve<StoryblokModuleService>(STORYBLOK_MODULE);

    logger.info("Deleting Storyblok product stories...");

    const deleted_story = await sbModuleService.deleteProductStory({
      id: product_id,
    });

    return new StepResponse(deleted_story);
  }
);
