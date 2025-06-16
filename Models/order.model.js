const mongoose = require("mongoose")

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "product",
        required: true,
      },
      size: {
        type: String,
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
    },
  ],
  subtotal: {
    type: Number,
    required: true,
  },
  deliveryCharge: {
    type: Number,
    required: true,
  },
  total: {
    type: Number,
    required: true,
  },
  shippingAddress: {
    type: String,
    required: true,
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ["COD", "Card", "UPI", "Wallet"],
  },
  paymentStatus: {
    type: String,
    default: "Pending",
    enum: ["Pending", "Completed", "Failed", "Refunded"],
  },
  orderStatus: {
    type: String,
    default: "Processing",
    enum: ["Processing", "Shipped", "Delivered", "Cancelled", "Returned"],
  },
   razorpayOrderId: {
    type: String,
  },
  razorpayPaymentId: {
    type: String,
  },
  razorpaySignature: {
     type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Ordermodel = mongoose.model("Order", orderSchema);

module.exports = Ordermodel