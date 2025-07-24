const express = require("express");
const router = express.Router();
const Cart = require("../models/cart");
const { Product } = require("../models/product");
const { User } = require("../models/user");

// POST - Add item to cart
router.post('/', async (req, res) => {
  const { familyId, productId, userId, quantity = 1 } = req.body;

  try {
    // Validate required fields
    if (!familyId || !productId || !userId) {
      return res.status(400).json({  message: "جميع الحقول مطلوبة (familyId, productId, userId)" });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "المستخدم غير موجود" });
    }

    // Check if family exists
    const family = await User.findById(familyId);
    if (!family || family.type !== 'family') {
      return res.status(404).json({ message: "العائلة غير موجودة" });
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "المنتج غير موجود" });
    }

    // Check if item already exists in cart
    let cartItem = await Cart.findOne({ familyId, productId, userId });

    if (cartItem) {
      // Update quantity if item exists
      cartItem.quantity += parseInt(quantity);
      cartItem = await cartItem.save();
    } else {
      // Create new cart item
      cartItem = new Cart({
        familyId,
        productId,
        userId,
        quantity: parseInt(quantity),
      });
      cartItem = await cartItem.save();
    }

    // Populate the cart item
    const populatedCartItem = await Cart.findById(cartItem._id);

    res.status(201).json({
      message: "تم إضافة المنتج إلى السلة بنجاح",
      cartItem: populatedCartItem
    });

  } catch (error) {
    console.error("Error adding to cart:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({ message: "المنتج موجود بالفعل في السلة" });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({ message: "تنسيق المعرف غير صحيح" });
    }
    
    return res.status(500).json({ message: "خطأ داخلي في الخادم" });
  }
});

// GET - Get cart items grouped by family
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;

    // Build query
    let query = {};
    if (userId) {
      query.userId = userId;
    }

    // Get all cart items with populated data
    const cartItems = await Cart.find(query)
      .populate('familyId', 'userName email type phoneNumber _id').populate('productId', 'name price image description discount count_in_stock')
      .populate('userId', 'userName email').sort({ createdAt: -1 });

    const validCartItems = [];
    const invalidCartItems = [];

    for (const item of cartItems) {
      if (!item.productId) {
        await Cart.findByIdAndDelete(item._id);
        invalidCartItems.push(item._id);
      } else {
        validCartItems.push(item);
      }
    }

    // Group cart items by family
    const groupedByFamily = validCartItems.reduce((acc, item) => {
      const familyId = item.familyId._id.toString();

      if (!acc[familyId]) {
        acc[familyId] = {
          family: {
            id: item.familyId._id,
            userName: item.familyId.userName,
            email: item.familyId.email,
            type: item.familyId.type,
            phoneNumber: item.familyId.phoneNumber
          },
          products: [],
          totalItems: 0,
          totalPrice: 0
        };
      }

      const price = item.productId.price;
      const discountPercent = item.productId.discount || 0;
      const priceAfterDiscount = price * (1 - discountPercent / 100);
      const itemTotal = priceAfterDiscount * item.quantity;

      acc[familyId].products.push({
        cartId: item._id,
        product: item.productId,
        user: item.userId,
        quantity: item.quantity,
        priceAfterDiscount: priceAfterDiscount,
        itemTotal: itemTotal,
        addedAt: item.createdAt
      });

      acc[familyId].totalItems += item.quantity;
      acc[familyId].totalPrice += itemTotal;

      return acc;
    }, {});

    const familiesWithProducts = Object.values(groupedByFamily);

    res.status(200).json({
      totalFamilies: familiesWithProducts.length,
      totalCartItems: validCartItems.length,
      removedInvalidCartItems: invalidCartItems, // optional: useful for debugging
      families: familiesWithProducts
    });

  } catch (error) {
    console.error("Error getting cart items:", error);

    if (error.name === 'CastError') {
      return res.status(400).json({ message: "تنسيق المعرف غير صحيح" });
    }

    return res.status(500).json({ message: "خطأ داخلي في الخادم" });
  }
});


// GET - Get cart item count for a specific user
router.get('/getCartCounter', async (req, res) => {
  try {
    const { userId } = req.query;

    let query = {};
    if (userId) {
      query.userId = userId;
    }

    // Get all cart items with populated data
    const cartItems = await Cart.find(query).countDocuments();
    console.log("Total cart items:", cartItems);
    res.status(200).json({
      totalCartItems: cartItems
    });

  } catch (error) {
    console.error("Error getting cart items:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ message: "تنسيق المعرف غير صحيح" });
    }
    
    return res.status(500).json({ message: "خطأ داخلي في الخادم" });
  }
});


// GET - Get cart items for specific family
router.get('/family/:familyId', async (req, res) => {
  try {
    const { familyId } = req.params;
    const { userId } = req.query;

    // Build query
    let query = { familyId };
    if (userId) {
      query.userId = userId;
    }

    // Check if family exists
    const family = await User.findById(familyId);
    if (!family || family.type !== 'family') {
      return res.status(404).json({ message: "العائلة غير موجودة" });
    }

    const cartItems = await Cart.find(query)
      .populate('familyId', 'userName email type phoneNumber')
      .populate('productId', 'name price image description discount count_in_stock')
      .populate('userId', 'userName email')
      .sort({ createdAt: -1 });

    let totalPrice = 0;
    let totalItems = 0;

    const productsWithDetails = cartItems.map(item => {
      const price = item.productId.price;
      const discountPercent = item.productId.discount || 0;

      // ✅ حساب السعر بعد الخصم كنسبة مئوية
      const priceAfterDiscount = price * (1 - discountPercent / 100);
      const itemTotal = priceAfterDiscount * item.quantity;

      totalPrice += itemTotal;
      totalItems += item.quantity;

      return {
        cartId: item._id,
        product: item.productId,
        user: item.userId,
        quantity: item.quantity,
        priceAfterDiscount: priceAfterDiscount,
        itemTotal: itemTotal,
        addedAt: item.createdAt
      };
    });

    res.status(200).json({
      family: {
        id: family._id,
        userName: family.userName,
        email: family.email,
        type: family.type,
        phoneNumber: family.phoneNumber
      },
      totalItems: totalItems,
      totalPrice: totalPrice,
      products: productsWithDetails
    });

  } catch (error) {
    console.error("Error getting family cart:", error);

    if (error.name === 'CastError') {
      return res.status(400).json({ message: "تنسيق معرف العائلة غير صحيح" });
    }

    return res.status(500).json({ message: "خطأ داخلي في الخادم" });
  }
});


// PUT - Update cart item quantity
router.put('/update/:cartId', async (req, res) => {
  try {
    const { cartId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: "الكمية يجب أن تكون أكبر من صفر" });
    }

    // جلب عنصر السلة
    const cartItem = await Cart.findById(cartId);
    if (!cartItem) {
      return res.status(404).json({ message: "عنصر السلة غير موجود" });
    }

    // جلب بيانات المنتج المرتبط بعنصر السلة
    const product = await Product.findById(cartItem.productId);
    if (!product) {
      return res.status(404).json({ message: "المنتج غير موجود" });
    }

    // // تحقق من الحد الأقصى للكمية المتوفرة
    // if (quantity > product.count_in_stock) {
    //   return res.status(400).json({
    //     message: `الكمية المطلوبة أكبر من الحد الأقصى المتوفر من المنتج. المتوفر: ${product.count_in_stock}`
    //   });
    // }

    // تحديث الكمية
    const updatedCartItem = await Cart.findByIdAndUpdate( cartId , { quantity: parseInt(quantity) },  { new: true }  ).populate('familyId', 'userName email type')
      .populate('productId', 'name price image description discount').populate('userId', 'userName email');

    res.status(200).json({ message: "تم تحديث الكمية بنجاح", cartItem: updatedCartItem });

  } catch (error) {
    console.error("Error updating cart item:", error);

    if (error.name === 'CastError') {
      return res.status(400).json({ message: "تنسيق المعرف غير صحيح" });
    }

    return res.status(500).json({ message: "خطأ داخلي في الخادم" });
  }
});


// PUT - Batch update cart item quantities
router.put('/update-multiple', async (req, res) => {
  try {
    const updates = req.body; // Expecting an array

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: "يجب إرسال مصفوفة من العناصر." });
    }

    // نتيجة التحديثات
    let results = [];

    for (const item of updates) {
      const { cartId, quantity } = item;

      if (!cartId || !Number.isInteger(quantity) || quantity < 1) {
        results.push({  cartId,  success: false,  message: "الكمية يجب أن تكون أكبر من صفر ومعرف السلة مطلوب."  });
        continue;
      }


      const cartItem = await Cart.findById(cartId);
      if (!cartItem) {
        results.push({  cartId,  success: false,  message: "عنصر السلة غير موجود"  });
        continue;
      }

      const product = await Product.findById(cartItem.productId);
      if (!product) {
        results.push({  cartId,  success: false,  message: "المنتج غير موجود"  });
        continue;
      }

      // if (quantity > product.count_in_stock && product.count_in_stock !== 0) {
      //   results.push({  cartId,  success: false,  message: `الكمية المطلوبة أكبر من الحد الأقصى المتوفر من المنتج. المتوفر: ${product.count_in_stock}`  });
      //   continue;
      // }

      const updatedCartItem = await Cart.findByIdAndUpdate(  cartId,  { quantity: quantity },  { new: true } )
        .populate('familyId', 'userName email type').populate('productId', 'name price image description discount').populate('userId', 'userName email');

      results.push({  cartId,  success: true,  cartItem: updatedCartItem  });
    }

    res.status(200).json({ message: "تمت معالجة جميع العناصر", results });
  } catch (error) {
    console.error("Batch update error:", error);
    res.status(500).json({ message: "خطأ داخلي في الخادم" });
  }
});


// DELETE - Remove item from cart
router.delete('/remove/:cartId', async (req, res) => {
  try {
    const { cartId } = req.params;

    const cartItem = await Cart.findById(cartId);
    if (!cartItem) {
      return res.status(404).json({ message: "عنصر السلة غير موجود" });
    }

    await Cart.findByIdAndDelete(cartId);

    res.status(200).json({
      message: "تم حذف المنتج من السلة بنجاح",
      deletedItem: {
        id: cartItem._id,
        familyId: cartItem.familyId,
        productId: cartItem.productId,
        userId: cartItem.userId
      }
    });

  } catch (error) {
    console.error("Error removing cart item:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ message: "تنسيق المعرف غير صحيح" });
    }
    
    return res.status(500).json({ message: "خطأ داخلي في الخادم" });
  }
});


router.delete('/clear/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const mongoose = require('mongoose');

    const objectId = new mongoose.Types.ObjectId(userId);

    const items = await Cart.find({ userId: objectId });
    console.log(`Found ${items.length} items to delete for user ${userId}`);

    const result = await Cart.deleteMany({ userId: objectId });

    res.status(200).json({
      message: "تم مسح السلة بنجاح",
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error("Error clearing cart:", error);

    if (error.name === 'CastError') {
      return res.status(400).json({ message: "تنسيق معرف المستخدم غير صحيح" });
    }

    res.status(500).json({ message: "خطأ داخلي في الخادم" });
  }
});


module.exports = router;
