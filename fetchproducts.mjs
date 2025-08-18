// fetchproducts.mjs
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
const API_VERSION = process.env.API_VERSION || "2025-01";

export async function fetchProducts(limit = 5) {
  const url = `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/products.json?limit=${limit}`;
  try {
    const res = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();

    // Shopify returns products inside `data.products`
    return data.products || [];
  } catch (err) {
    console.error("Error fetching products:", err.message);
    return [];
  }
}
