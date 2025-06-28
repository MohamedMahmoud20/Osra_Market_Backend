const express = require("express");
const router = express.Router();
const UserOrder = require("../models/userOrder");
const OrderFamily = require("../models/orderFamily");
const Cart = require("../models/cart");
const { Product } = require("../models/product");
const { User } = require("../models/user");


// GET - Get orders for specific family (simplified)
router.get('/family/:familyId', async (req, res) => {
  try {
    const { familyId } = req.params;

    // Check if family exists
    const family = await User.findById(familyId);
    if (!family || family.type !== 'family') {
      return res.status(404).json({ message: "العائلة غير موجودة" });
    }

    // Build query for OrderFamily
    let orderFamilyQuery = { familyId };
  

    // Get OrderFamily documents for this family
    const orderFamilies = await OrderFamily.find(orderFamilyQuery)
      .populate('userId familyId')
      .populate('products.productId', 'name price image description discount count_in_stock').sort({ createdAt: -1 });

    res.status(200).send(orderFamilies);

  } catch (error) {
    console.error("Error getting family orders:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ message: "تنسيق معرف العائلة غير صحيح" });
    }
    
    return res.status(500).json({ message: "خطأ داخلي في الخادم" });
  }
});

// POST - Create order from families data
router.post('/', async (req, res) => {
  const { userId, orderNotes = '' , phone , address , location} = req.body;

  try {
    // Validate required fields
    if (!userId) {
      return res.status(400).json({ message: "معرف المستخدم مطلوب" });
    }
    const cartItems = await Cart.find(req.baseUrl.userId).populate('familyId', 'userName email type phoneNumber')
      .populate('productId', 'name price image description discount count_in_stock').populate('userId', 'userName email').sort({ createdAt: -1 });

    // Group cart items by family
    const groupedByFamily = cartItems.reduce((acc, item) => {
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
        };
      }

      console.log("Processing item:", item);
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

      return acc;
    }, {});

    // Convert to array format
    const familiesWithProducts = Object.values(groupedByFamily);

    if (!familiesWithProducts || !Array.isArray(familiesWithProducts) || familiesWithProducts.length === 0) {
      return res.status(400).json({ message: "بيانات العائلات مطلوبة ويجب أن تكون مصفوفة غير فارغة" });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "المستخدم غير موجود" });
    }

    let totalAmount = 0;
    const createdOrderFamilies = [];
    const cartIdsToDelete = [];

    // Process each family from the request
    for (const familyData of familiesWithProducts) {
      const { family, products } = familyData;

      if (!family || !family.id || !products || !Array.isArray(products)) {
        return res.status(400).json({ message: "بنية بيانات العائلة غير صحيحة" });
      }

      // Check if family exists
      const familyExists = await User.findById(family.id);
      if (!familyExists || familyExists.type !== 'family') {
        return res.status(404).json({ message: `العائلة ${family.userName} غير موجودة` });
      }

      const orderProducts = [];
      let familySubtotal = 0;

      for (const productData of products) {
        const { cartId, product, quantity } = productData;

        const productExists = await Product.findById(product._id);
        if (!productExists) {
          return res.status(404).json({ message: `المنتج ${product.name} غير موجود` });
        }

        if (productExists.stock_limit) {
          if (productExists.count_in_stock < quantity) {
            return res.status(400).json({  message: `المنتج "${product.name}" غير متوفر بالكمية المطلوبة. المتوفر: ${productExists.count_in_stock}`  });
          }
        }

        const productPrice = product.price;
        const discountPercent = product.discount || 0;
        const priceAfterDiscount = productPrice * (1 - discountPercent / 100);
        const calculatedItemTotal = priceAfterDiscount * quantity;

        orderProducts.push({
          productId: product._id,
          quantity: quantity,
          price: productPrice,
          priceAfterDiscount: priceAfterDiscount,
          discount: discountPercent,
          itemTotal: calculatedItemTotal
        });

        familySubtotal += calculatedItemTotal;
        cartIdsToDelete.push(cartId);

        if (productExists.stock_limit) {
          await Product.findByIdAndUpdate(  product._id,   { $inc: { count_in_stock: -quantity } }  );
        }
      }

      const orderFamily = new OrderFamily({
        userId: userId,
        familyId: family.id,
        products: orderProducts,
        subtotal: familySubtotal,
        orderStatus: 'pending'
      });

      const savedOrderFamily = await orderFamily.save();
      createdOrderFamilies.push(savedOrderFamily._id);
      totalAmount += familySubtotal;
    }

    const userOrder = new UserOrder({
      userId: userId,
      ordersFamily: createdOrderFamilies,
      totalAmount: totalAmount,
      orderStatus: 'pending',
      phone: phone,
      location: location,
      address: address,
      orderNotes: orderNotes
    });

    const savedUserOrder = await userOrder.save();

    await OrderFamily.updateMany( { _id: { $in: createdOrderFamilies } }, { userOrderId: savedUserOrder._id } );

    if (cartIdsToDelete.length > 0) {
      await Cart.deleteMany({ _id: { $in: cartIdsToDelete } });
    }

    const populatedOrder = await UserOrder.findById(savedUserOrder._id);

    res.status(201).json({
      message: "تم إنشاء الطلب بنجاح وتم مسح السلة",
      order: populatedOrder,
      summary: {
        totalFamilies: familiesWithProducts.length,
        totalProducts: cartIdsToDelete.length,
        totalAmount: totalAmount,
        cartItemsDeleted: cartIdsToDelete.length
      }
    });

  } catch (error) {
    console.error("Error creating order:", error);

    if (error.message.includes('المنتج') || error.message.includes('العائلة')) {
      return res.status(400).json({ message: error.message });
    }

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

// GET - Get user orders (with auto update if all families are delivered)
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.query;

    // تحقق من وجود المستخدم
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "المستخدم غير موجود" });
    }

    // بناء الاستعلام
    let query = { userId };
    if (status) {
      query.orderStatus = status;
    }

    // جلب الطلبات
    const orders = await UserOrder.find(query)
      .populate({
        path: 'ordersFamily',
        populate: [
          { path: 'familyId' },
          { path: 'products.productId', select: 'name price image description discount' }
        ]
      }).sort({ createdAt: -1 });

      // تحقق من حالة الطلبات العائلية وتحديث حالة الطلب الرئيسية إذا لزم الأمر

    for (const order of orders) {
      if (
        order.ordersFamily.length > 0 &&
        order.ordersFamily.every(fam => fam.orderStatus === 'delivered') &&
        order.orderStatus !== 'delivered'
      ) {
        await UserOrder.findByIdAndUpdate(order._id, { orderStatus: 'delivered' });
        order.orderStatus = 'delivered'; // تحديث داخل الذاكرة أيضًا
      }
    }

    res.status(200).json(orders);

  } catch (error) {
    console.error("Error getting user orders:", error);

    if (error.name === 'CastError') {
      return res.status(400).json({ message: "تنسيق معرف المستخدم غير صحيح" });
    }

    return res.status(500).json({ message: "خطأ داخلي في الخادم" });
  }
});


// PUT - Update family order status
router.put('/family/order/:orderFamilyId', async (req, res) => {
  try {
    const { orderFamilyId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "حالة الطلب مطلوبة" });
    }

    const updatedFamilyOrder = await OrderFamily.findByIdAndUpdate( orderFamilyId, { orderStatus: status }, { new: true } );

    if (!updatedFamilyOrder) {
      return res.status(404).json({ message: "طلب العائلة غير موجود" });
    }

    res.status(200).json({
      message: "تم تحديث حالة طلب العائلة بنجاح",
      orderFamily: updatedFamilyOrder
    });

  } catch (error) {
    console.error("Error updating family order status:", error);

    if (error.name === 'CastError') {
      return res.status(400).json({ message: "تنسيق معرف الطلب غير صحيح" });
    }

    return res.status(500).json({ message: "خطأ داخلي في الخادم" });
  }
});



// GET - Get cart item count for a specific user
router.get('/getOrderCounter', async (req, res) => {
  try {
    const { userId , orderStatus , type} = req.query;

    let query = {};
    if (userId) {
      query.userId = userId;
    }

    if (orderStatus) {
      query.orderStatus = orderStatus;
    }

    let orderItems ;

    if(type==="family"){
    orderItems = await OrderFamily.find(query).countDocuments();
    }else{
    orderItems = await UserOrder.find(query).countDocuments();
    }


    res.status(200).json({
      totalOrderItems: orderItems
    });

  } catch (error) {
    console.error("Error getting cart items:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({ message: "تنسيق المعرف غير صحيح" });
    }
    
    return res.status(500).json({ message: "خطأ داخلي في الخادم" });
  }
});



module.exports = router;
