// src/admin/routes/custom/page.tsx
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { StoryblokLogo } from "../../components/icons/storyblok-logo";
import { SbProductsTable } from "../../components/table/products-table";
import { Container } from "@medusajs/ui";

const CustomPage = () => {
  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col items-start justify-between py-4">
        <SbProductsTable />
      </div>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Storyblok",
  icon: StoryblokLogo,
});

export default CustomPage;
