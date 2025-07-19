const { User } = require("../models/user");
const express = require("express");
const router = express.Router();
const { postImageLocatianSpecify, whichUpload } = require("../imageStorage");
const cloudinary = require("../utils/cloudinary");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const {  body , validationResult  } = require("express-validator");

// Validation middleware
const validate = (validations) => {
  return async (req, res, next) => {
    for (let validation of validations) {
      const result = await validation.run(req);
      if (result.errors.length) break;
    }

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    res.status(400).json({ errors: errors.array() });
  };
};

// GET all users with pagination and filtering
router.get(`/`, async (req, res) => {
  try {
    let filter = {};

    // Apply filters based on query parameters
    if (req.query.type) {
      filter.type = req.query.type;
    }

    if (req.query.status !== undefined) {
      filter.status = req.query.status === 'true';
    }

    if (req.query.userName) {
      filter.userName = { $regex: req.query.userName, $options: 'i' };
    }

    if (req.query.email) {
      filter.email = { $regex: req.query.email, $options: 'i' };
    }

    const page = parseInt(req.query.page);
    const limit = 10;
    const skip = (page - 1) * limit;

    const userListLength = (await User.find(filter)).length;

    let userList;

    if (page) {
      userList = await User.find(filter).select("-password").skip(skip).limit(limit).sort({ createdAt: -1 });
    } else {
      userList = await User.find(filter).select("-password").sort({ createdAt: -1 });
    }

    if (!userList) {
      return res.status(500).json({ success: false });
    }

    if (page) {
      res.status(200).json({ 
        num_of_pages: Math.ceil(userListLength / limit), 
        total_count: userListLength,
        data: userList 
      });
    } else {
      res.status(200).send(userList);
    }

  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET single user by ID
router.get(`/:id`, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({ 
        message: "The user with the given ID was not found." 
      });
    }

    return res.status(200).send(user);

  } catch (error) {
    console.error("Error fetching user:", error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: "Invalid user ID format" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
});

// POST - Create new user (admin, family, client)

router.post(
  `/`,
  whichUpload.single("image"),
  validate([
    body("userName").notEmpty().withMessage("Username is required").isLength({ min: 2 }).withMessage("Username must be at least 2 characters long"),
    body("email").isEmail().withMessage("Please provide a valid email address"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters long"),
    body("phoneNumber").notEmpty().withMessage("Phone number is required"),
    body("countryCode").notEmpty().withMessage("Country code is required"),
    body("type").isIn(["admin", "family", "client"]).withMessage("Type must be either admin, family, or client")
  ]),
  async (req, res) => {
    try {
      const existingUserByEmail = await User.findOne({ email: req.body.email.trim() });
      if (existingUserByEmail) {
        return res.status(400).json({ message: "هذا البريد الإلكتروني مستخدم من قبل" });
      }

      const existingUserByPhone = await User.findOne({ phoneNumber: req.body.phoneNumber.trim() });
      if (existingUserByPhone) {
        return res.status(400).json({ message: "رقم الهاتف موجود بالفعل" });
      }

      const existingUserByUsername = await User.findOne({ userName: req.body.userName.trim() });
      if (existingUserByUsername) {
        return res.status(400).json({ message: "اسم المستخدم موجود من قبل" });
      }

    let imagePath = null;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {  folder: "product_images",  });

      imagePath = {
        url: result.secure_url,
        publicId: result.public_id,
      };
    }
    
      let newUser = new User({
        userName: req.body.userName.trim(),
        email: req.body.email.trim().toLowerCase(),
        phoneNumber: req.body.phoneNumber.trim(),
        description: req.body.description || "",
        activityDescription: req.body.activityDescription || "",
        bankAccountNumber : req.body.bankAccountNumber || "",
        countryCode: req.body.countryCode.trim(),
        password: bcrypt.hashSync(req.body.password, 10),
        address: req.body.address || "",
        location: req.body.location || "",
        type: req.body.type,
        status: req.body.status !== undefined ? req.body.status : true,
        image: imagePath ? imagePath.url : "https://semantic-ui.com/images/wireframe/image.png",
      });

      newUser = await newUser.save();
      if (!newUser) {
        return res.status(400).json({ message: "لا يمكن إنشاء المستخدم" });
      }

      const userResponse = await User.findById(newUser._id).select("-password");
      return res.status(201).json({ message: "تم إنشاء المستخدم بنجاح", data: userResponse });

    } catch (error) {
      console.error("Error creating user:", error);
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        return res.status(400).json({ message: `هذا ${field} موجود من قبل` });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);


router.post("/login", async (req, res) => {

    try {
        const { email, password } = req.body;
        let userFound = await User.findOne( { email: email.toLowerCase() });
      if (!userFound) { return res.status(400).send({ message: "الريد الالكتروني غير مسجل بالنظام" }); }
    
      if (!bcrypt.compareSync(password, userFound.password)) {
        return res.status(400).json({ message: "كلمة المرور غير صحيحة" });
      }
       userFound.password = undefined; 
      const secret = process.env.secret;
      if(userFound.status === false) {
        return res.status(400).send({ message: "لقد تم حظر هذا المستخدم من الأداره" });
      }

      const token = jwt.sign(  {  userId: userFound.id,  userName: userFound.userName,  },   secret  );
      userFound = await User.findByIdAndUpdate( userFound.id, { token : token } , {new: true});
       return res.status(200).send(userFound);

    } catch (error) {
        return res.status(500).send({ message: error || "حدثت مشكله اثناء عمليه الأضافه", });
    }

});

router.put("/:id", whichUpload.single("image"), async (req, res) => {
  try {
    const userId = req.params.id;
    const existingUser = await User.findById(userId);

    if (!existingUser) {
      return res.status(404).json({ message: "المستخدم غير موجود" });
    }

    // التحقق من البريد الإلكتروني
    if (req.body.email) {
      const emailExists = await User.findOne({
        email: req.body.email.trim().toLowerCase(),
        _id: { $ne: userId },
      });
      if (emailExists) {
        return res.status(400).json({ message: "هذا البريد الإلكتروني مستخدم من قبل" });
      }
    }

    // التحقق من رقم الهاتف
    if (req.body.phoneNumber) {
      const phoneExists = await User.findOne({
        phoneNumber: req.body.phoneNumber.trim(),
        _id: { $ne: userId },
      });
      if (phoneExists) {
        return res.status(400).json({ message: "هذا الرقم موجود من قبل" });
      }
    }

    // التحقق من اسم المستخدم
    if (req.body.userName) {
      const usernameExists = await User.findOne({
        userName: req.body.userName.trim(),
        _id: { $ne: userId },
      });
      if (usernameExists) {
        return res.status(400).json({ message: "اسم المستخدم موجود من قبل" });
      }
    }

    // تحضير بيانات التحديث
    const updateData = {
      userName: req.body.userName?.trim(),
      email: req.body.email?.trim().toLowerCase(),
      phoneNumber: req.body.phoneNumber?.trim(),
      description: req.body.description,
      activityDescription: req.body.activityDescription,
      bankAccountNumber : req.body.bankAccountNumber,
      countryCode: req.body.countryCode?.trim(),
      address: req.body.address,
      location: req.body.location,
      type: req.body.type,
      status: req.body.status,
    };

    if (req.body.password) {
      updateData.password = bcrypt.hashSync(req.body.password, 10);
    }

    if (req.file) {
      if (existingUser.imagePublicId) {
        await cloudinary.uploader.destroy(existingUser.imagePublicId);
      }

      const result = await cloudinary.uploader.upload(req.file.path, {  folder: "user_images",  });

      updateData.image = result.secure_url;
      updateData.imagePublicId = result.public_id;
    }

    Object.keys(updateData).forEach((key) => {  if (updateData[key] === undefined) {  delete updateData[key];  }  });

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {  new: true,  runValidators: true, }).select("-password");

    if (!updatedUser) {
      return res.status(500).json({ message: "لا يمكن تحديث المستخدم" });
    }

    return res.status(200).json({ message: "تم تحديث بيانات المستخدم", data: updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ message: "تنسيق معرف المستخدم غير صحيح" });
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({ message: `هذا ${field} موجود من قبل` });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "خطأ في التحقق من البيانات",
        errors: Object.values(error.errors).map((e) => e.message),
      });
    }

    return res.status(500).json({ message: "خطأ داخلي في الخادم" });
  }
});


router.put("/userDisable/:id", async (req, res) => {
  try {
    
    
         await User.findByIdAndUpdate( req.params.id, { 
          active_users :  req.body.status,
          status : req.body.status , token : null },{new : true});

  
      return res.status(200).send("Done");

  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal Server Error");
  }
});


router.post("/forgetpassword", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "يرجى إدخال البريد الإلكتروني" });
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() });

   if (user.type !== "client") {
      return res.status(403).json({ message: "غير مسموح إلا للعميل فقط بتغيير كلمة المرور" });
    }


  if (user) {
    return res.status(200).json({
       message: "البريد الالكتروني صحيح",
       "data": user
      
      });
  } else {
    return res.status(404).json({ message: "هذا البريد غير مسجل" });
  }
});



router.put("/changepassword/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const { currentPassword, newPassword } = req.body;

    // تحقق من وجود المستخدم
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "المستخدم غير موجود" });
    }

    if (user.type !== "client") {
      return res.status(403).json({ message: "غير مسموح إلا للعميل فقط بتغيير كلمة المرور" });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" });
    }

    // تحديث كلمة المرور
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({ message: "تم تغيير كلمة المرور بنجاح" });
  } catch (error) {
    console.error("Error changing password:", error);
    return res.status(500).json({ message: "خطأ داخلي في الخادم" });
  }
});

// DELETE user (optional - for completeness)
router.delete("/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ 
        message: "The user with the given ID was not found." 
      });
    }

    return res.status(200).json({ 
      message: "User deleted successfully",
      deletedUser: { id: user._id, userName: user.userName }
    });

  } catch (error) {
    console.error("Error deleting user:", error);

    if (error.name === 'CastError') {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;