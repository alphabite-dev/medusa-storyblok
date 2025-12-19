export const QUERY_KEYS = {
  SB_PRODUCT: (id: string) => ["sb_product", id] as const,
  SB_PRODUCTS: ({ offset, limit }: { offset?: number; limit?: number } = {}) =>
    ["sb_products", { offset, limit }] as const,
};
