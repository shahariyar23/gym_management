const crypto = require("crypto");
const SSLCommerzPayment = require("sslcommerz-lts");
const accessoriesOrderSchema = require("../../model/accessoriesOrder.model.js");
const Cart = require("../../model/Cart.model.js");
const Accessories = require("../../model/Accessories.model.js");
const store_id = process.env.REACT_APP_STORE_ID;
const store_passwd = process.env.REACT_APP_STORE_PASSWD;
const is_live = false;

const createAccessoriesOrder = async (req, res) => {
  const id = crypto.randomBytes(16).toString("hex");
  const {
    userId,
    cartId,
    cartItems,
    addressInfo,
    orderStatus,
    paymentMethod,
    paymentStatus,
    totalAmount,
    orderDate,
    orderUpdateDate,
    paymentId,
  } = req.body;
  const data = {
    total_amount: totalAmount,
    currency: "BDT",
    tran_id: id, // use unique tran_id for each api call
    success_url: `http://localhost:5000/api/gym/accessories/order/payment/success/${id}`,
    fail_url: `http://localhost:5000/api/gym/accessories/order/payment/fail/${id}`,
    cancel_url: "http://localhost:5173/gym/payment/cancel",
    ipn_url: "http://localhost:3030/ipn",
    shipping_method: "Courier",
    product_name: "Computer.",
    product_category: "Electronic",
    product_profile: "general",
    cus_name: addressInfo.name,
    cus_email: addressInfo.email,
    cus_add1: addressInfo.address,
    cus_add2: addressInfo.address,
    cus_city: addressInfo.city,
    cus_state: addressInfo.notes,
    cus_postcode: "1000",
    cus_country: "Bangladesh",
    cus_phone: addressInfo.phone,
    cus_fax: "01711111111",
    ship_name: addressInfo.name,
    ship_add1: addressInfo.address,
    ship_add2: addressInfo.address,
    ship_city: addressInfo.city,
    ship_state: addressInfo.notes,
    ship_postcode: 1000,
    ship_country: "Bangladesh",
  };

  let GatewayPageURL;
  const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
  sslcz.init(data).then(async (apiResponse) => {
    // Redirect the user to payment gateway
    GatewayPageURL = apiResponse.GatewayPageURL;
    const newOrder = new accessoriesOrderSchema({
      userId,
      cartId,
      cartItems,
      addressInfo,
      orderStatus,
      paymentMethod,
      paymentStatus,
      totalAmount,
      orderDate,
      orderUpdateDate,
      paymentId: data.tran_id,
    });
    await newOrder.save();
    data.tran_id = "";
    res.status(201).json({
      success: true,
      url: GatewayPageURL,
      orderId: newOrder?._id,
    });
  });
};

const accessoriesPaymentSuccess = async (req, res) => {
  const result = await accessoriesOrderSchema.updateOne(
    {
      paymentId: req?.params?.trnID,
    },
    {
      $set: {
        paymentStatus: "paid",
      },
    }
  );

  if (result.modifiedCount > 0) {
    res.redirect(
      `http://localhost:5173/gym/payment/accessories/success/${req?.params?.trnID}`
    );
  }
};
const accessoriesPaymentFail = async (req, res) => {
  const result = await accessoriesOrderSchema.updateOne(
    {
      paymentId: req?.params?.trnID,
    },
    {
      $set: {
        paymentStatus: "fail",
      },
    }
  );

  if (result.modifiedCount > 0) {
    res.redirect(
      `http://localhost:5173/gym/payment/fail/${req?.params?.trnID}`
    );
  }
};

const accessoriesCapturePayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    let order = await accessoriesOrderSchema.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Oder not found",
      });
    }
    order.orderStatus = "confirmed";
    const cartId = order.cartId;
    for (let item of order.cartItems) {
      let accessories = await Accessories.findById(item?.accessoriesId);
      if (!accessories) {
        return res.status(404).json({
          success: false,
          message: `Not enough stock for this product ${accessories.title}`,
        });
      }

      accessories.totalStock -= item.quantity;
      console.log(accessories, "final accessories");

      await accessories.save();
    }
    await Cart.findByIdAndDelete(cartId);
    await order.save();

    res.status(200).json({
      success: true,
      message: "Order confirmed",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error?.message,
    });
  }
};

const getAllAccessoriesOrderByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await accessoriesOrderSchema.find({ userId });
    if (!orders.length) {
      return res.status(404).json({
        success: false,
        message: "No orders found",
      });
    }
    res.status(200).json({
      success: true,
      data: orders,
      message: "Order successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error happend",
    });
  }
};

const getAccessoriesOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await accessoriesOrderSchema.findById(id);
    if (!order) {
      return res.status(404).json({
        success: true,
        message: "Order is not found",
      });
    }
    res.status(201).json({
      success: true,
      message: "Order deltail get successfully",
      data: order,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error happend",
    });
  }
};

module.exports = {
  getAllAccessoriesOrderByUser,
  getAccessoriesOrderDetails,
  createAccessoriesOrder,
  accessoriesPaymentSuccess,
  accessoriesPaymentFail,
  accessoriesCapturePayment,
};
