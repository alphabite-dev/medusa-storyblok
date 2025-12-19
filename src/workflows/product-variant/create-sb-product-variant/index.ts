import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk";
import { createSbProductVariantsStep } from "./steps/create-sb-product-variant-step";
import { getProductsStep } from "@medusajs/medusa/core-flows";

type CreatSbProductVariantInput = {
  product_id: string;
  variant_ids: string[];
};

export const createSbProductVariantsWorkflowId = "create-sb-product-variants-workflow";

export const createSbProductVariantsWorkflow = createWorkflow(
  {
    name: createSbProductVariantsWorkflowId,
    retentionTime: 10000,
    store: true,
  },
  function ({ product_id, variant_ids }: CreatSbProductVariantInput) {
    const foundProducts = getProductsStep({ ids: [product_id] });

    const product = transform({ foundProducts }, (data) => ({
      id: data.foundProducts[0].id,
      handle: data.foundProducts[0].handle,
      title: data.foundProducts[0].title,
    }));

    const foundVariants = transform({ foundProducts }, (data) => data.foundProducts[0].variants || []);

    const variants = transform({ foundVariants, variant_ids }, (data) =>
      (data.foundVariants || [])
        .filter((variant) => (data?.variant_ids || []).includes(variant.id))
        .map((variant) => ({
          id: variant.id,
          title: variant.title,
        }))
    );

    const result = createSbProductVariantsStep({ variants, product });

    return new WorkflowResponse(result);
  }
);
