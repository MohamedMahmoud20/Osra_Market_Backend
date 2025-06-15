const { Product } = require("../models/product");
const { User } = require("../models/user");
const { Comment } = require("../models/comment");
const cloudinary = require("../utils/cloudinary");
const express = require("express");
const router = express.Router();
const { whichUpload } = require("../imageStorage");


// GET - الحصول على جميع المنتجات مع التصفية والترقيم
router.get(`/`, async (req, res) => {
  try {
    const { familyId, name } = req.query;
    let filter = {};
    
    if (familyId) {
      const family = await User.findById(familyId);
      if (!family) {
        return res.status(404).json({   success: false,   message: "العائلة غير موجودة"   });
      }
      
      if (family.status === false) {
        return res.status(200).json({ num_of_pages: 0,  total_count: 0,  data: []  });
      }
      
      filter.familyId = familyId;
    }
    
    if (name) {
      filter.name = { $regex: name, $options: 'i' };
    }
  
    let productList;
   
      productList = await Product.find(filter).populate([
        { path: 'familyId', select: 'userName email type phoneNumber status image ' },
        { path: 'comments', populate: { path: 'user', select: 'userName email' } }  ]).sort({ createdAt: -1 });
    

    if (!productList) {
      return res.status(500).json({ success: false });
    }

    const activeProductList = productList.filter(product => {  return product.familyId && product.familyId.status !== false;  });

    res.status(200).send(activeProductList);

  } catch (error) {
    console.error("خطأ في جلب المنتجات:", error);
    res.status(500).json({ message: "خطأ داخلي في الخادم" });
  }
});


// GET - الحصول على منتج واحد بالمعرف
router.get(`/:id`, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).populate([ 
         { path: 'familyId', select: 'userName email type phoneNumber' },{ path: 'comments', populate: { path: 'user', select: 'userName email' } }]);    

    if (!product) {
         return res.status(404).json({   message: "المنتج بالمعرف المحدد غير موجود."  });
    }
    
    return res.status(200).send(product);
    
  } catch (error) {
    console.error("خطأ في جلب المنتج:", error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: "تنسيق معرف المنتج غير صحيح" });
    }
    return res.status(500).json({ message: "خطأ داخلي في الخادم" });
  }
});


// POST - إنشاء منتج جديد مع رفع الصورة
router.post(`/`, whichUpload.single("image"), async (req, res) => {
  try {
    const {  name,  description,  price,  familyId,  discount,  count_in_stock,  stock_limit,  status, } = req.body;

    const family = await User.findById(familyId);
    if (!family) {
      return res.status(400).json({message: "العائلة المحددة غير موجودة"});
    }

    if (family.type !== "family") {
      return res.status(400).json({message :"المعرف المحدد ليس لعائلة"});
    }

    const existingProduct = await Product.findOne({  name: name.trim(),  familyId: familyId,  });

    if (existingProduct) {
      return res.status(400).json({message: "اسم المنتج موجود بالفعل لدى هذه العائلة"});
    }

    let imagePath = null;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {  folder: "product_images",  });

      imagePath = {
        url: result.secure_url,
        publicId: result.public_id,
      };
    }

    let newProduct = new Product({
      name: name.trim(),
      image: imagePath ? imagePath.url : "https://semantic-ui.com/images/wireframe/image.png",
      imagePublicId: imagePath ? imagePath.publicId : "",
      description: description?.trim(),
      price: parseFloat(price),
      stock_limit: Boolean(stock_limit) || false,
      count_in_stock: parseInt(count_in_stock) || 0,
      discount: parseFloat(discount) || 0,
      familyId: familyId,
      status: status ?? true,
    });

    newProduct = await newProduct.save();

    if (!newProduct) {
      return res.status(400).send("لا يمكن إنشاء المنتج");
    }

    const productResponse = await Product.findById(newProduct._id).populate(  "familyId",  "userName address type phoneNumber"  );

    res.status(201).send(productResponse);
  } catch (error) {
    console.error("خطأ في إنشاء المنتج:", error);

    if (error.code === 11000) {
      return res.status(400).send("بيانات مكررة");
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "خطأ في التحقق من البيانات",
        errors: Object.values(error.errors).map((e) => e.message),
      });
    }

    res.status(500).json({ message: "خطأ داخلي في الخادم" });
  }
});



// PUT - تحديث منتج مع إمكانية تغيير الصورة
router.put("/:id", whichUpload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const {  name,  description,  price,  familyId,  discount,  count_in_stock,  stock_limit,  status,  } = req.body;

    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({ message: "المنتج غير موجود." });
    }

    if (familyId && familyId !== existingProduct.familyId.toString()) {
      const family = await User.findById(familyId);
      if (!family) {
        return res.status(400).send("العائلة المحددة غير موجودة");
      }

      if (family.type !== "family") {
        return res.status(400).send("النوع المحدد ليس لعائلة");
      }
    }

    if (name) {
      const duplicateProduct = await Product.findOne({  name: name.trim(),  familyId: familyId || existingProduct.familyId,  _id: { $ne: id },  });

      if (duplicateProduct) {
        return res.status(400).send("اسم المنتج موجود بالفعل لدى هذه العائلة");
      }
    }

    const updateData = {
      name: name?.trim(),
      description: description?.trim(),
      price: price ? parseFloat(price) : undefined,
      stock_limit: stock_limit,
      count_in_stock: count_in_stock ? parseInt(count_in_stock) : undefined,
      discount: discount ? parseFloat(discount) : undefined,
      familyId: familyId,
      status: status,
    };
  
    if (req.file) {
  if (existingProduct.imagePublicId) {
    await cloudinary.uploader.destroy(existingProduct.imagePublicId);
  }

   updateData.image = req.file.path || req.file.url;
   updateData.imagePublicId = req.file.filename || req.file.public_id;
}

    Object.keys(updateData).forEach((key) => {  if (updateData[key] === undefined) {  delete updateData[key];  }  });

    const updatedProduct = await Product.findByIdAndUpdate(id, updateData, {  new: true,  runValidators: true  }).populate("familyId", "userName email type");

    if (!updatedProduct) {
      return res.status(500).send("لا يمكن تحديث المنتج");
    }

    return res.status(200).send(updatedProduct);

  } catch (error) {
    console.error("خطأ في تحديث المنتج:", error);

    if (error.name === "CastError") {
      return res.status(400).json({ message: "تنسيق معرف المنتج غير صحيح" });
    }

    if (error.code === 11000) {
      return res.status(400).send("بيانات مكررة");
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({  message: "خطأ في التحقق من البيانات",  errors: Object.values(error.errors).map((e) => e.message),  });
    }

    res.status(500).json({ message: "خطأ داخلي في الخادم" });
  }
});


// POST - Add comment to product
router.post('/addComment', async (req, res) => {
  const { userId, productId, comment } = req.body;

  try {
    // Validate required fields
    if (!userId || !productId || !comment) {
      return res.status(400).json({  message: "جميع الحقول مطلوبة (userId, postId, comment)" });
    }

    const existingComment = await Comment.findOne({ user: userId, product: productId });
    if (existingComment) {
        return res.status(400).json({ message: "لا يمكن إضافة أكثر من تعليق لنفس المنتج من نفس المستخدم" });
    }


    // Create new comment object
    let commentObject = new Comment({
      user: userId,
      product: productId,
      comment: comment.trim(),
    });

    // Save the comment
    commentObject = await commentObject.save();

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).send("المنتج غير موجود");
    }
    await Product.findByIdAndUpdate(  productId,  { $push: { comments: commentObject._id } },  { new: true }  );

    res.status(201).json(commentObject);

  } catch (error) {
    console.error("Error creating comment:", error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: "خطأ في التحقق من البيانات",
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({ message: "تنسيق المعرف غير صحيح" });
    }
    
    return res.status(500).json({ message: "خطأ داخلي في الخادم" });
  }
});





// DELETE - حذف منتج
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({  message: "المنتج بالمعرف المحدد غير موجود."  });
    }

    // حذف المنتج من قاعدة البيانات
    await Product.findByIdAndDelete(id);

    return res.status(200).json({
      message: "تم حذف المنتج بنجاح",
      deletedProduct: { 
        id: product._id, 
        name: product.name,
        familyId: product.familyId
      }
    });

  } catch (error) {
    console.error("خطأ في حذف المنتج:", error);
    if (error.name === 'CastError') {
      return res.status(400).json({ message: "تنسيق معرف المنتج غير صحيح" });
    }
    res.status(500).json({ message: "خطأ داخلي في الخادم" });
  }
});


module.exports = router;
