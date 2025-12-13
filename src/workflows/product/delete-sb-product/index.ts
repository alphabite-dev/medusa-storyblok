import { createWorkflow, WorkflowResponse } from "@medusajs/workflows-sdk";
import { deleteSbProductStep } from "./steps/delete-sb-product-step";

type DeleteSbProductInput = {
  product_id: string;
};

export const deleteSbProductWorkflowId = "delete-sb-product-workflow";
export const deleteSbProductWorkflow = createWorkflow(
  {
    name: deleteSbProductWorkflowId,
  },
  function ({ product_id }: DeleteSbProductInput) {
    const result = deleteSbProductStep({ product_id });

    return new WorkflowResponse(result);
  }
);
