const express = require("express");
const cors = require("cors");
const connection = require("./config/db");
var cookieParser = require("cookie-parser");
const userRouter = require("./Routes/user.routes");
const productRouter = require("./Routes/product.routes");
const path = require("path");
const cartRouter = require("./Routes/cart.routes");
const orderRouter = require("./Routes/order.routes");
require("dotenv").config();

const app = express();
app.use(express.json());
app.set("view engine", "ejs");
app.use(cookieParser());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://nike-frontend-sooty.vercel.app",
      "https://nike-frontend-b19bimyki-pratik-amrutkars-projects.vercel.app",
    ],
    credentials: true,
  })
);

app.get("/", (req, res) => {
  res.send("Backend running...");
});

//Routes
app.use("/api/user", userRouter);
app.use("/api/product", productRouter);
app.use("/api/cart", cartRouter);
app.use("/api/order", orderRouter);

app.use("/user", express.static(path.join(__dirname, "uploads/user")));
app.use("/product", express.static(path.join(__dirname, "uploads/product")));

app.listen(process.env.PORT || 3000, async () => {
  try {
    await connection;
    console.log("server is running");
  } catch (error) {
    console.log(error);
  }
});
