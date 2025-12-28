import { defineLink } from "@medusajs/framework/utils";
import StoryblokModule from "../modules/storyblok";
import ProductModule from "@medusajs/medusa/product";

export default defineLink(
  {
    linkable: StoryblokModule.linkable.productStoryblokLink,
    field: "product_id", // field on ProductStoryblokLink that holds the product ID
    isList: false, // one product per link
  },
  ProductModule.linkable.product,
  {
    readOnly: true, // only virtual link, no link table (since we store product_id in the model)
  }
);

