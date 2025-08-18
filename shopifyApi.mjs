// shopifyApi.mjs
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();
import { enrichProduct } from "./aiCategorizer.mjs"; // AI + Unsplash enrichment

// Shopify env variables
const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
const API_VERSION = process.env.API_VERSION;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;

// -------------------- Shopify API Helpers --------------------

// Fetch existing products from Shopify
export async function fetchProducts(limit = 50) {
  try {
    const url = `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/products.json?limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) throw new Error(`Shopify API error: ${res.status} ${res.statusText}`);
    const data = await res.json();
    return data.products || [];
  } catch (err) {
    console.error("Error fetching products:", err.message);
    return [];
  }
}

// Update a single Shopify product
export async function updateProduct(product) {
  try {
    const url = `https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/products/${product.id}.json`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "X-Shopify-Access-Token": ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product: {
          id: product.id,
          title: product.title,
          tags: product.tags.join(", "),
          images: product.image ? [product.image] : [],
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Failed to update product ${product.id}: ${text}`);
      return null;
    }

    console.log(`✅ Updated product ${product.id}: "${product.title}" -> ${product.tags.join(", ")}`);
    return await res.json();
  } catch (err) {
    console.error("Error updating product:", err.message);
    return null;
  }
}

// -------------------- Enrichment & Batch Update --------------------

export async function enrichAndUpdateProducts(limit = 50, batchSize = 5) {
  try {
    const products = await fetchProducts(limit);
    let batch = [];

    for (const product of products) {
      const enriched = await enrichProduct(product); // AI category + Unsplash image
      batch.push(enriched);

      if (batch.length >= batchSize) {
        await Promise.all(batch.map(p => updateProduct(p)));
        batch = [];
      }
    }

    if (batch.length > 0) {
      await Promise.all(batch.map(p => updateProduct(p)));
    }

    console.log("✅ All products enriched and updated successfully!");
  } catch (err) {
    console.error("Error enriching/updating products:", err);
  }
}

// -------------------- CLI Arguments --------------------

// Example: node shopifyApi.mjs --limit 100 --batch 10
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url === process.argv[1]) {
  const args = process.argv.slice(2);
  let limit = 50;
  let batchSize = 5;

  args.forEach((arg, i) => {
    if (arg === "--limit" && args[i + 1]) limit = parseInt(args[i + 1], 10);
    if (arg === "--batch" && args[i + 1]) batchSize = parseInt(args[i + 1], 10);
  });

  console.log(`Starting enrichment: limit=${limit}, batchSize=${batchSize}`);
  enrichAndUpdateProducts(limit, batchSize);
}
