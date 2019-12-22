const { Product, Category, Input } = require("./models");

async function addCategory(name, userId = "kopiro") {
  const category = new Category({
    name,
    userId
  });
  await category.save();
  return category;
}

async function addProduct(name, categoryName, unit, userId = "kopiro") {
  let category = await Category.findOne({ name: categoryName, userId });
  if (!category) {
    category = await addCategory(category);
  }

  const product = new Product({
    _id: name,
    category: category._id,
    unit,
    userId
  });
  await product.save();
  return product;
}

async function addInput(
  productName,
  categoryName,
  quantity,
  unit,
  userId = "kopiro"
) {
  // Find the product first
  let product = await Product.findOne({ name: productName, userId });
  if (!product) {
    product = await addProduct(productName, categoryName, unit, userId);
  }

  if (product.unit !== unit) {
    throw new Error("PRODUCT_UNIT_MISMATCH");
  }

  const input = new Input({
    product: productName,
    quantity: Number(quantity),
    date: new Date(),
    userId
  });
  await input.save();
  return input;
}

async function getStockQuantityFor(productName, userId = "kopiro") {
  const product = await Product.findById(productName);
  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  const inputs = await Input.find({ product: productName, userId });

  let finalQty = 0;
  for (const input of inputs) {
    finalQty += input.quantity;
  }

  return { quantity: finalQty, unit: product.unit, name: product._id };
}

async function getStock() {
  const products = await Product.find();
  const stock = [];
  for (const product of products) {
    try {
      stock.push(await getStockQuantityFor(product._id));
    } catch (err) {
      console.error(err);
    }
  }
  return stock;
}

async function getStockUnderMinQuantity() {
  const products = await Product.find();
  const list = [];
  for (const product of products) {
    try {
      const stock = await getStockQuantityFor(product._id);
      if (stock.quantity < product.minQuantity) {
        list.push(stock);
      }
    } catch (err) {
      console.error(err);
    }
  }
  return list;
}

module.exports = {
  addInput,
  getStockQuantityFor,
  getStock,
  getStockUnderMinQuantity
};
