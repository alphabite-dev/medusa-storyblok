import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { AdminProduct, DetailWidgetProps } from "@medusajs/types";
import { ArrowUpRightOnBox, Spinner } from "@medusajs/icons";
import { Button, Container } from "@medusajs/ui";
import { useRetrieveSbProduct } from "../hooks/query/use-retrieve-sb-product";

const ProductWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const { data: sbProductData, isLoading } = useRetrieveSbProduct({
    product_id: data.id,
  });

  if (isLoading) {
    return <Spinner className="animate-spin" />;
  }

  if (!sbProductData) {
    return null;
  }

  return (
    <Container>
      <h2 className="h2-core font-sans font-medium mr-4">Storyblok Editor</h2>
      <a href={sbProductData.storyblok_editor_url} target="_blank" rel="noreferrer">
        <Button variant="transparent">
          <ArrowUpRightOnBox /> Open in Storyblok
        </Button>
      </a>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "product.details.side.before",
});

export default ProductWidget;
