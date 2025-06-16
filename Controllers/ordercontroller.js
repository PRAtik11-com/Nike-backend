const CartModel = require("../Models/cart.model");
const Ordermodel = require("../Models/order.model");
const mongoose = require("mongoose");
const instance = require("../config/razorpay");

const orderController = {
  createOrder: async (req, res) => {
    try {
      const { shippingAddress, paymentMethod } = req.body;
      const userId = req.user._id;

      console.log("Received shippingAddress:", shippingAddress);
      console.log("Received paymentMethod:", paymentMethod);
      console.log("User ID from req.user:", req.user?._id);

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      // Get user's cart with proper population
      const cart = await CartModel.findOne({ user: userId }).populate({
        path: "items.product",
        select: "price title stockCount",
        model: "product", // Must match your model name exactly
      });

      if (!cart) {
        return res.status(404).json({ message: "Cart not found" });
      }

      if (cart.items.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }

      // Validate all product references
      const invalidProducts = cart.items.filter(
        (item) => !mongoose.Types.ObjectId.isValid(item.product?._id)
      );
     

      if (invalidProducts.length > 0) {
        return res.status(400).json({
          message: "Cart contains invalid product references",
          invalidProducts,
        });
      }

      // Rest of your order creation logic...
      const subtotal = cart.items.reduce(
        (total, item) => total + (item.product?.price || 0) * item.quantity,
        0
      );

      const deliveryCharge = 1250;
      const total = subtotal + deliveryCharge;

      // Create order items with proper ObjectId conversion
      const orderItems = cart.items.map((item) => ({
        product: new mongoose.Types.ObjectId(item.product._id),
        size: item.size,
        quantity: item.quantity,
        price: item.product.price,
      }));

      // Create and save order
      const order = new Ordermodel({
        user: new mongoose.Types.ObjectId(userId),
        items: orderItems,
        subtotal,
        deliveryCharge,
        total,
        shippingAddress,
        paymentMethod,
      });

      await order.save();

      // Clear cart
      await CartModel.updateOne(
      { _id: cart._id },
      { $set: { items: [] } }
    );

      res.status(201).json(order);
    } catch (error) {
      console.error("Order creation error:", error);
      res.status(500).json({
        message: "Failed to create order",
        error: error.message,
      });
    }
  },
  getOrderById: async (req, res) => {
    try {
      const order = await Ordermodel.findById(req.params.id)
        .populate("items.product", "title productImage")
        .populate("user", "name email");

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Verify order belongs to requesting user (or admin)
      if (
        order.user._id.toString() !== req.user._id.toString() &&
        !req.user.isAdmin
      ) {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  },
  getUserOrders: async (req, res) => {
    try {
      const orders = await Ordermodel.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .populate("items.product", "title productImage");

      res.json(orders);
    } catch (error) {
      console.error("Error fetching user orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  },
  createRazorpayOrder : async (req, res) => {
  try {
    const { totalAmount } = req.body;

    const options = {
      amount: totalAmount * 100, 
      currency: "INR",
      receipt: `receipt_order_${Date.now()}`,
    };

    const order = await instance.orders.create(options);
    res.status(200).json(order);
  } catch (err) {
    console.error("Razorpay Order Error:", err);
    res.status(500).json({ message: "Failed to create payment order" });
  }
}
};

module.exports = orderController;
