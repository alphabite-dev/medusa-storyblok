import { Module } from "@medusajs/framework/utils";
import StoryblokModuleService from "./service";

export const STORYBLOK_MODULE = "product_storyblok_story";

export default Module(STORYBLOK_MODULE, {
  service: StoryblokModuleService,
});
