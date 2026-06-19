// Shopify Storefront API types
export interface MoneyV2 {
  amount: string;
  currencyCode: string;
}

export interface Image {
  url: string;
  altText: string | null;
  width?: number;
  height?: number;
}

export interface ProductVariant {
  id: string;
  title: string;
  price: MoneyV2;
  compareAtPrice: MoneyV2 | null;
  availableForSale: boolean;
  selectedOptions: {
    name: string;
    value: string;
  }[];
}

export interface Product {
  id: string;
  title: string;
  handle: string;
  description: string;
  descriptionHtml: string;
  tags: string[];
  availableForSale: boolean;
  featuredImage: Image | null;
  images: { nodes: Image[] };
  variants: { nodes: ProductVariant[] };
  priceRange: {
    minVariantPrice: MoneyV2;
    maxVariantPrice: MoneyV2;
  };
}

// Customizer types
export type PaintingStyle = "classic-oil" | "impressionist";

export type Step = "create" | "preview" | "details" | "checkout";

export interface CustomizerState {
  step: Step;
  photoUrl: string;
  photoFileId: string;
  style: PaintingStyle;
  size: string;
  frame: string;
  jobId: string;
  resultUrl: string;
  status: "idle" | "uploading" | "generating" | "done" | "error";
}

// App API types
export interface JobStatusResponse {
  status: "pending" | "processing" | "completed" | "failed" | "not_found";
  result_url?: string;
  error?: string;
}

export interface UploadResponse {
  photo_url: string;
  job_id: string;
}

export interface GenerateResponse {
  job_id: string;
  status: string;
}
