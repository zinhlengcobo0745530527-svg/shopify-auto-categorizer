// aiCategorizer.mjs
import dotenv from "dotenv";
dotenv.config();
import fetch from "node-fetch";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

const CATEGORY_MAP = { 
  Men: ["Shirts", "Shoes", "Accessories", "Pants"], 
  Women: ["Dresses", "Shoes", "Accessories"], 
  Kids: ["Boys","Girls","Toys","Shoes","Accessories"], 
  Beauty:["Makeup Tools","Skincare","Hair Care"], 
  "Home Improvement":["Furniture","Decor","Tools","Lighting"],
  Clothing:["Loungewear","Casual","Formal"]
};

const AGE_GROUPS = { 
  Men:["Adult","Teen"], 
  Women:["Adult","Teen"], 
  Kids:["0-2","3-5","6-12","13-17"], 
  Beauty:["Adults","All Ages"], 
  "Home Improvement":["All Ages"],
  Clothing:["Adults","All Ages"]
};

// -------------------- Helpers --------------------
function detectMainCategory(product){
  const title = product.title.toLowerCase();
  for (const category of Object.keys(CATEGORY_MAP)) {
    if (title.includes(category.toLowerCase())) return category;
  }
  return "Miscellaneous";
}

function detectSubCategory(product, mainCategory){
  const title = product.title.toLowerCase();
  const subs = CATEGORY_MAP[mainCategory] || [];
  for (const sub of subs) {
    if (title.includes(sub.toLowerCase())) return sub;
  }
  return "Other";
}

function detectAgeGroup(mainCategory){
  const ages = AGE_GROUPS[mainCategory] || ["All"];
  return ages[0];
}

async function fetchProductImage(productTitle) {
  const query = encodeURIComponent(productTitle);
  const url = `https://api.unsplash.com/search/photos?query=${query}&client_id=${UNSPLASH_ACCESS_KEY}&per_page=1`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      return { src: data.results[0].urls.full };
    }
    console.warn(`No Unsplash image found for "${productTitle}"`);
    return null;
  } catch (error) {
    console.error('Error fetching Unsplash image:', error);
    return null;
  }
}

// -------------------- AI Categorization --------------------

// helper wait function
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function categorizeWithAI(product) {
  const messages = [
    {
      role: "system",
      content: "You are a product categorizer. Return JSON with {category, subCategory, ageGroup, suggestedTitle}."
    },
    {
      role: "user",
      content: `Categorize this product: "${product.title}". Description: "${product.body_html || ""}".`
    }
  ];

  const models = ["gpt-4o-mini", "gpt-3.5-turbo"];
  let lastError;

  for (const model of models) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await openai.chat.completions.create({
          model,
          messages,
          temperature: 0.3,
          max_tokens: 200
        });
        const result = JSON.parse(response.choices[0].message.content);
        console.log(`✅ Categorized with ${model} (attempt ${attempt})`);
        return result;
      } catch (err) {
        lastError = err;
        if (err.error?.code === "rate_limit_exceeded") {
          const waitTime = 10000 * Math.pow(2, attempt - 1);
          console.log(`⏳ Rate limit on ${model}. Waiting ${waitTime/1000}s before retry #${attempt}...`);
          await wait(waitTime);
        } else {
          console.log(`❌ Error with ${model}: ${err.message}`);
          break;
        }
      }
    }
    console.log(`⚠️ Switching to fallback model: ${model === "gpt-4o-mini" ? "gpt-3.5-turbo" : "none"}`);
  }

  throw lastError;
}

// -------------------- Shopify Helpers --------------------
export async function fetchProducts(limit=50){
  const url=`https://${process.env.SHOPIFY_DOMAIN}/admin/api/${process.env.API_VERSION}/products.json?limit=${limit}`;
  const res = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN,
      "Content-Type": "application/json"
    }
  });
  const data = await res.json();
  return data.products || [];
}

async function updateProductsBatch(productsBatch){
  const updatePromises = productsBatch.map(p => {
    const url=`https://${process.env.SHOPIFY_DOMAIN}/admin/api/${process.env.API_VERSION}/products/${p.id}.json`;
    return fetch(url, {
      method:"PUT",
      headers:{
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN,
        "Content-Type":"application/json"
      },
      body: JSON.stringify({ product:{ id: p.id, title: p.title, tags: p.tags.join(", "), images: p.image ? [p.image] : [] } })
    }).then(res => {
      if(!res.ok) return res.text().then(text => console.error(`Failed to update ${p.id}: ${text}`));
      console.log(`Batch updated product ${p.id}: "${p.title}" -> ${p.tags.join(", ")}`);
    });
  });
  await Promise.all(updatePromises);
}

// -------------------- Enrichment --------------------
export async function enrichProduct(product) {
  let main = detectMainCategory(product);
  let sub = detectSubCategory(product, main);
  let age = detectAgeGroup(main);
  let newTitle = product.title;
  let image = await fetchProductImage(product.title);

  if (main === "Miscellaneous") {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const aiResult = await categorizeWithAI(product);
        if (aiResult.category && aiResult.category !== "Miscellaneous") {
          main = aiResult.category;
          sub = aiResult.subCategory || "Other";
          age = aiResult.ageGroup || "All";
          newTitle = aiResult.suggestedTitle || product.title;
          break;
        }
      } catch (err) {
        console.log(`❌ AI categorization failed for "${product.title}", attempt ${attempt}: ${err.message}`);
        await wait(5000);
      }
    }
  }

  const tags = [main, sub, age];
  return { id: product.id, title: newTitle, tags, image };
}

// -------------------- Main Execution --------------------
(async()=>{
  try {
    const products = await fetchProducts(50);
    const batchSize = 5;
    let productsToUpdate = [];

    for (const product of products){
      const enriched = await enrichProduct(product);
      productsToUpdate.push(enriched);

      if(productsToUpdate.length >= batchSize){
        await updateProductsBatch(productsToUpdate);
        productsToUpdate = [];
      }
    }

    if(productsToUpdate.length > 0){
      await updateProductsBatch(productsToUpdate);
    }

    console.log("All products processed with AI + Unsplash image fetch + batch updates.");
  } catch(err){
    console.error("Error in AI categorization:", err);
  }
})();

// -------------------- Export --------------------
export { categorizeWithAI };
