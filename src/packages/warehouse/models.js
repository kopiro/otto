const mongoose = require("mongoose");
const autopopulate = require("mongoose-autopopulate");

const PREFIX = "pkg_warehouse_";

const { Schema } = mongoose;

const ProductSchema = new Schema({
  name: String,
  minQuantity: Number,
  unit: String,
  userId: String,
  category: {
    type: String,
    ref: `${PREFIX}categories`,
    autopopulate: true
  }
});
ProductSchema.plugin(autopopulate);
const Product = mongoose.model(`${PREFIX}products`, ProductSchema);

const CategorySchema = new Schema({
  name: String,
  userId: String
});
const Category = mongoose.model(`${PREFIX}categories`, CategorySchema);

const InputSchema = new Schema({
  date: Date,
  quantity: Number,
  userId: String,
  product: { type: String, ref: `${PREFIX}products`, autopopulate: true }
});
InputSchema.plugin(autopopulate);
const Input = mongoose.model(`${PREFIX}Inputs`, InputSchema);

module.exports = { Product, Category, Input };
