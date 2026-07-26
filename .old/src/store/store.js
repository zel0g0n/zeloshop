import { configureStore } from "@reduxjs/toolkit";
import productReducer from '@/store/slices/product/getProductSlice'
import favoritesReducer from '@/store/slices/product/favoriteSlice'
import cartsReducer from '@/store/slices/product/cartSlice'
import singleProductReducer from '@/store/slices/product/getSingleProductSlice'
import sendOrderReducer from '@/store/slices/order/sendOrderSlice'
import getClientDataReducer from '@/store/slices/profile/getClientDataSlice'
import updateProfileReducer from '@/store/slices/profile/updateProfileSlice'
import getSellerOrderList from '@/store/slices/seller/getOrdersSlice'
import changeOrderStatus from '@/store/slices/seller/changeOrderSlice'
import addProduct from '@/store/slices/seller/addProductSlice'
import clientOrdersList from '@/store/slices/seller/getClientOrderSlice'
import getSellerProducts from '@/store/slices/seller/getSellerProductsSlice'
export const store = configureStore({
  reducer: {
    products:  productReducer,
    favorites: favoritesReducer,
    carts: cartsReducer,
    singleProduct: singleProductReducer,
    orders: sendOrderReducer,
    profile: getClientDataReducer,
    profileEdit: updateProfileReducer,
    sellerOrdersList: getSellerOrderList,
    changeOrderStatus: changeOrderStatus,
    addProduct: addProduct,
    clientOrdersList: clientOrdersList,
    sellerProductsList: getSellerProducts

  }
})