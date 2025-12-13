import { ContainerRegistrationKeys, MedusaError, promiseAll } from "@medusajs/utils";
import { createStep, StepResponse } from "@medusajs/workflows-sdk";
import { STORYBLOK_MODULE } from "../../../../modules/storyblok";
import StoryblokModuleService from "../../../../modules/storyblok/service";

export type UpdateSbProductStepInput = {
  product_id: string;
};

export const updateSbProductStep = createStep(
  {
    name: "update-sb-product",
  },
  async ({ product_id }: UpdateSbProductStepInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const storyblok = container.resolve<StoryblokModuleService>(STORYBLOK_MODULE);

    logger.info("Syncing Storyblok with Medusa products...");

    const { data } = await query.graph({
      entity: "product",
      filters: { id: product_id },
      fields: ["id", "title", "handle"],
    });

    const product = data?.[0];

    if (!product) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `Product with id ${product_id} not found`);
    }

    await storyblok.updateProductStory(product);

    return new StepResponse({});
  },

  async (rollbackData, { container }) => {
    if (!rollbackData) return;

    // const link = container.resolve(ContainerRegistrationKeys.LINK);
    // const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    // const sbModuleService = container.resolve<StoryblokModuleService>(STORYBLOK_MODULE);

    // logger.warn("Storyblok sync rollback started...");

    // await promiseAll(
    //   rollbackData.map(async ({ after, before, product_storyblok_story_id }) => {
    //     if (!before) {
    //       if (product_storyblok_story_id) {
    //         await link.delete({
    //           product_storyblok_story: { id: product_storyblok_story_id },
    //         });
    //       }
    //       return sbModuleService.deleteSbProductStory({
    //         id: String(after.data.story.id),
    //       });
    //     }

    //     const { id, ...rest } = before;

    //     return sbModuleService.updateSbProductStory({
    //       id: String(id),
    //       product: {
    //         title: rest.content.title,
    //         subtitle: rest.content.subtitle,
    //         description: rest.content.description,
    //         handle: rest.content.handle,
    //         thumbnail: rest.content.thumbnail,
    //         images: rest.content.images,
    //         id: String(id),
    //         variants: rest.content.variants,
    //       },
    //     });
    //   })
    // );
  }
);
