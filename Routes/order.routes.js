const express = require("express");
const Auth = require("../middleware/auth");
const orderController = require("../Controllers/ordercontroller");

const orderRouter = express.Router();

orderRouter.post("/createOrder", Auth,orderController.createOrder);
orderRouter.get("/getUserOrders", Auth, orderController.getUserOrders);
orderRouter.get("/getOrderById/:id", Auth, orderController.getOrderById);
orderRouter.post("/razorpay", Auth, orderController.createRazorpayOrder);


module.exports = orderRouter