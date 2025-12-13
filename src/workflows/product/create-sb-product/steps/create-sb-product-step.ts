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
      fields: ["id", "title", "handle"],
    });

    await sb.createProductStory(data[0]);

    return new StepResponse({});
  },

  async (rollbackData, { container }) => {
    if (!rollbackData) return;

    // const link = container.resolve(ContainerRegistrationKeys.LINK);
    // const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    // const sbModuleService = container.resolve<SbModuleService>(STORYBLOK_MODULE);

    // logger.warn("Sb sync rollback started...");

    // await promiseAll(
    //   rollbackData.map(async ({ after, before, product_sb_story_id }) => {
    //     if (!before) {
    //       if (product_sb_story_id) {
    //         await link.delete({
    //           product_sb_story: { id: product_sb_story_id },
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
