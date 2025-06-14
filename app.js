const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const morgan = require("morgan");
const mongoose = require("mongoose");
const path = require("path");
const {User}  = require("./models/user");
const jwt = require("jsonwebtoken");
const { promisify } = require('util');
const cors = require("cors");
require("dotenv/config");
app.use(cors());
app.options("*", cors);
// middleware
app.use(bodyParser.json());
app.use(morgan("tiny"));
app.use("/public/uploads", express.static(__dirname + "/public/uploads"));

// routers
const userRouter = require("./routes/users");
const productRouter = require("./routes/products");
const cartRouter = require("./routes/carts");
const orderRouter = require("./routes/orders");


const api = process.env.API_URL;
app.use(`${api}/users`, userRouter);
app.use(`${api}/products`, productRouter);
app.use(`${api}/cart`, cartRouter);
app.use(`${api}/orders`, orderRouter);



mongoose.connect(process.env.CONNECTION_STRING).then(() => { console.log("DB connection is ready");  }) .catch((err) => {  console.log(err); });

  app.use(express.static("public/build"));

  app.get("/*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "public", "build", "index.html"));
  });
  
  const PORT = process.env.PORT || 80;
  
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}.`);
  });