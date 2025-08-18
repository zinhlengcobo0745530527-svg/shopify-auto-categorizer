import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { exec } from "child_process";
import { getProducts, updateProduct } from "./app/utils/shopifyApi.mjs"; // removed addTags
import aiCategorizer from "./app/utils/aiCategorizer.mjs";

dotenv.config();
const app = express();
app.use(bodyParser.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;
const ZROK_URL = process.env.ZROK_URL || "";

// -----------------------------
// Routes
// -----------------------------
app.get("/", (req, res) => res.send("Server is running!"));

app.get("/products", async (req, res) => {
  try {
    const products = await getProducts(50);
    res.json(products);
  } catch (err) {
    console.error("Error fetching products:", err.message);
    res.status(500).send("Error fetching products");
  }
});

app.post("/categorize", async (req, res) => {
  try {
    const products = req.body.products;
    const categorized = await aiCategorizer(products);

    for (const p of categorized) {
      await updateProduct(p.id, { tags: p.tags.join(", ") });
    }

    res.json(categorized);
  } catch (err) {
    console.error("Error categorizing products:", err.message, err.stack);
    res.status(500).send("Error categorizing products");
  }
});

// -----------------------------
// Zrok Tunnel (Optional)
app.get("/start-tunnel", (req, res) => {
  exec("zrok share public 3000", (error, stdout, stderr) => {
    if (error) return res.status(500).send(`Error starting Zrok tunnel: ${error.message}`);
    res.send(`Zrok tunnel started:\n${stdout}`);
  });
});

// -----------------------------
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  if (ZROK_URL) console.log(`Zrok public URL: ${ZROK_URL}`);
});
