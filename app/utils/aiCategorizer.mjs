// app/utils/aiCategorizer.mjs
import fetch from "node-fetch";

// Example category mapping similar to Shein
const CATEGORY_MAP = {
  Men: ["Tops", "Bottoms", "Shoes", "Accessories"],
  Women: ["Tops", "Bottoms", "Dresses", "Shoes", "Accessories"],
  Kids: ["Boys", "Girls", "Toys", "Shoes", "Accessories"],
  "Home Improvement": ["Furniture", "Decor", "Tools", "Lighting"],
};

// Age group mapping
const AGE_GROUPS = {
  Men: ["Adult", "Teen"],
  Women: ["Adult", "Teen"],
  Kids: ["0-2", "3-5", "6-12", "13-17"],
};

// Helper functions
function detectMainCategory(product) {
  const title = product.title.toLowerCase();
  for (const category of Object.keys(CATEGORY_MAP)) {
    if (title.includes(category.toLowerCase())) return category;
  }
  return "Miscellaneous";
}

function detectSubCategory(product, mainCategory) {
  const title = product.title.toLowerCase();
  const subs = CATEGORY_MAP[mainCategory] || [];
  for (const sub of subs) {
    if (title.includes(sub.toLowerCase())) return sub;
  }
  return "Other";
}

function detectAgeGroup(mainCategory) {
  const ages = AGE_GROUPS[mainCategory] || ["All"];
  return ages[0];
}

async function fetchReviews(productTitle) {
  return [
    { review: `Great ${productTitle}! Loved it.`, rating: 5 },
    { review: `Not bad for the price.`, rating: 4 },
  ];
}

// Main categorization function
async function categorize(products) {
  const categorized = [];

  for (const product of products) {
    const mainCategory = detectMainCategory(product);
    const subCategory = detectSubCategory(product, mainCategory);
    const ageGroup = detectAgeGroup(mainCategory);
    const tags = [mainCategory, subCategory, ageGroup];
    const reviews = await fetchReviews(product.title);

    categorized.push({
      id: product.id,
      title: product.title,
      category: mainCategory,
      subCategory,
      ageGroup,
      tags,
      reviews,
    });
  }

  return categorized;
}

// ✅ Export default for ES module
export default categorize;
