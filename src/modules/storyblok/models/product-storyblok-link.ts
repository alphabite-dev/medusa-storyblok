import { model } from "@medusajs/framework/utils";

const ProductStoryblokLink = model
  .define("product_storyblok_link", {
    id: model.id({ prefix: "sbp" }).primaryKey(),
    product_id: model.text(),
    storyblok_story_id: model.text(),
  })
  .indexes([
    {
      on: ["product_id"],
      unique: true,
    },
    {
      on: ["storyblok_story_id"],
      unique: true,
    },
  ]);

export default ProductStoryblokLink;
