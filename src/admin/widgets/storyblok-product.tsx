import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { AdminProduct, DetailWidgetProps } from "@medusajs/types";
import { ArrowUpRightOnBox, ArrowPath } from "@medusajs/icons";
import { Button, Container, StatusBadge } from "@medusajs/ui";
import { useRetrieveSbProduct } from "../hooks/query/use-retrieve-sb-product";
import { useCreateSbProduct } from "../hooks/mutation/use-create-sb-product";

const ProductWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const { data: sbProductData, isLoading } = useRetrieveSbProduct({
    product_id: data.id,
  });

  const { mutateAsync, isPending } = useCreateSbProduct();

  return (
    <Container>
      <div className="flex justify-between">
        <h2 className="h2-core font-sans font-medium mr-4 flex items-center gap-2">
          Storyblok Editor
          <StatusBadge className="h-fit" color={sbProductData ? "green" : "red"}>
            {sbProductData ? "Synced" : "Not Synced"}
          </StatusBadge>
        </h2>
        {sbProductData ? (
          <a href={sbProductData.storyblok_editor_url} target="_blank" rel="noreferrer">
            <Button variant="secondary" isLoading={isLoading}>
              <ArrowUpRightOnBox /> Open in Storyblok
            </Button>
          </a>
        ) : (
          <Button variant="primary" onClick={async () => mutateAsync({ product_id: data.id })} isLoading={isPending}>
            <ArrowPath />
            Sync
          </Button>
        )}
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "product.details.side.before",
});

export default ProductWidget;
