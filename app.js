const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const morgan = require("morgan");
const mongoose = require("mongoose");
const path = require("path");
const { User } = require("./models/user");
const cors = require("cors");
require("dotenv/config");
const { decryptAES128ECB } = require("./helper/decrypt");

app.use(cors());
app.options("*", cors);

app.use(bodyParser.json());
app.use(morgan("tiny"));
app.use("/public/uploads", express.static(__dirname + "/public/uploads"));

// app.use(async (req, res, next) => {
//   try {
//     const encrypted = req.headers["x-client-id"]; 

//     // if (!encrypted) return next();

//     console.log("Encrypted ID:", encrypted);
//     const key = "osraGomma";
//     const decrypted = decryptAES128ECB('rVQfWMi2rx8AiVi0/cq+frV4V8T2Aqkh1Jky1MXqqI4=');
//     console.log("Decrypted ID:", decrypted);
//      const user = await User.findById(decrypted).select("-password");

//     if (!user) {
//       return res.status(404).json({ message: "المستخدم غير موجود" });
//     }

//     console.log("User:", user);
//     if (user.status === false) {
//       return res.status(256).json({ message: "غير مصرح" });
//     }else{
//       return next();
//     }

//   } catch (err) {
//     return res.status(400).json({ message: "فشل في فك التشفير" });
//   }
// });

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

// React frontend
app.use(express.static("public/build"));
app.get("/*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "public", "build", "index.html"));
});

const PORT = process.env.PORT || 80;
mongoose.connect(process.env.CONNECTION_STRING).then(() => {
  console.log("DB connection is ready");
}).catch((err) => {
  console.log(err);
});
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});