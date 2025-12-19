// src/admin/routes/custom/page.tsx
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Container, createDataTableColumnHelper, Heading } from "@medusajs/ui";
import { StoryblokLogo } from "../../components/icons/storyblok-logo";
import { sdk } from "../../lib/sdk";

const columnHelper = createDataTableColumnHelper<{ hello: string }>();

const CustomPage = async () => {
  const products = await sdk.admin.product.list({ limit: 50, offset: 0 });

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">This is my custom plugin page</Heading>
      </div>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Storyblok",
  icon: StoryblokLogo,
});

export default CustomPage;
