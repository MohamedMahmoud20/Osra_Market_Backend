const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const morgan = require("morgan");
const mongoose = require("mongoose");
const path = require("path");
const { User } = require("./models/user");
const { promisify } = require('util'); // استيراد promisify من util
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv/config");
const { decryptAES128ECB } = require("./helper/decrypt");

app.use(cors());
app.options("*", cors);

app.use(bodyParser.json());
app.use(morgan("tiny"));
app.use("/public/uploads", express.static(__dirname + "/public/uploads"));

async function middleWareForIsAdmin(req, res, next) {
   console.log("Admin  : " , req.headers.is_admin);
   const Token =  req.headers.authorization &&  req.headers.authorization.startsWith("Bearer ")  ?  req.headers.authorization.split(" ")[1] : null;
   console.log("Token  : " , Token);

   if( req.headers.is_admin=="true"){     

      console.log("Is Admin : " , req.headers.is_admin)
      next();
    }
    else if (Token){
      try {
        const decoded = await promisify(jwt.verify)(Token, process.env.secret);
        console.log("DECODED : " , decoded.userId);
        let user = await User.findById(decoded.userId);
        // console.log(user);
        if(user.token==null){
          return res.status(403).send({logout  : true});
         }
        console.log(user.token.slice(0,20));
        next();  
      } catch (error) {
        console.log("------------  " , error)
         return res.status(403).send({logout  : true});
      }
    }
    else{
      return res.status(403).send({logout  : true});
    }
    return ;
}

// routers
const userRouter = require("./routes/users");
const productRouter = require("./routes/products");
const cartRouter = require("./routes/carts");
const orderRouter = require("./routes/orders");


const api = process.env.API_URL;
app.use(`${api}/users`, middleWareForIsAdmin ,  userRouter);
app.use(`${api}/products`, middleWareForIsAdmin ,  productRouter);
app.use(`${api}/cart`, middleWareForIsAdmin ,  cartRouter);
app.use(`${api}/orders`, middleWareForIsAdmin , orderRouter);

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