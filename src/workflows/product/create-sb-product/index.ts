import { createWorkflow, WorkflowResponse } from "@medusajs/workflows-sdk";
import { createSbProductStep } from "./steps/create-sb-product-step";

type CreateSbProduct = {
  product_id: string;
};

export const createSbProductId = "create-sb-product-workflow";

export const createSbProductWorkflow = createWorkflow(
  {
    name: createSbProductId,
    retentionTime: 10000,
    store: true,
  },
  function ({ product_id }: CreateSbProduct) {
    const result = createSbProductStep({ product_id });

    return new WorkflowResponse(result);
  }
);
