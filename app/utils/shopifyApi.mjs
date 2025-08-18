// app/utils/shopifyApi.mjs
import fetch from "node-fetch";

const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
const API_KEY = process.env.SHOPIFY_API_KEY;
const API_VERSION = process.env.API_VERSION;

// Fetch products
export async function getProducts(limit = 10) {
  const url = `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/products.json?limit=${limit}`;
  const res = await fetch(url, {
    headers: { "X-Shopify-Access-Token": API_KEY },
  });
  const data = await res.json();
  return data.products || [];
}

// Update product info
export async function updateProduct(productId, updates) {
  const url = `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/products/${productId}.json`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": API_KEY,
    },
    body: JSON.stringify({ product: updates }),
  });
  return res.json();
}

// Add tags separately
export async function addTags(productId, tags = []) {
  const current = await getProducts(250); // get first 250 products
  const product = current.find(p => p.id === productId);
  const updatedTags = [...new Set([...(product?.tags || "").split(", "), ...tags])].join(", ");
  return updateProduct(productId, { tags: updatedTags });
}
