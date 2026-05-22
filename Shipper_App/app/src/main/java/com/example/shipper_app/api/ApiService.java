package com.example.shipper_app.api;

import com.example.shipper_app.model.Order;
import com.example.shipper_app.model.api.ApiResponse;
import com.example.shipper_app.model.api.LoginRequest;
import com.example.shipper_app.model.api.LoginResponse;
import com.example.shipper_app.model.api.RegisterRequest;

import java.util.List;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.PUT;
import retrofit2.http.DELETE;
import retrofit2.http.Path;

public interface ApiService {

    @POST("api/auth/login")
    Call<LoginResponse> login(@Body LoginRequest request);

    @POST("api/auth/register-shipper")
    Call<LoginResponse> registerShipper(@Body RegisterRequest request);

    @GET("api/driver/orders/available")
    Call<List<Order>> getAvailableOrders();

    @PUT("api/driver/orders/{id}/accept")
    Call<ApiResponse> acceptOrder(@Path("id") int orderId);

    @PUT("api/driver/orders/{id}/status")
    Call<ApiResponse> updateOrderStatus(@Path("id") int orderId, @Body OrderStatusRequest request);

    @GET("api/driver/orders/accepted")
    Call<List<Order>> getAcceptedOrders();

    @POST("api/driver/orders/{id}/cancel")
    Call<ApiResponse> cancelOrder(@Path("id") int orderId, @Body CancelRequest request);

    @POST("api/driver/orders/{id}/complaint")
    Call<ApiResponse> reportComplaint(@Path("id") int orderId, @Body ComplaintRequest request);

    @GET("api/driver/earnings/today")
    Call<EarningsResponse> getTodayEarnings();

    @GET("api/driver/notifications")
    Call<java.util.List<com.example.shipper_app.model.Notification>> getNotifications();

    @PUT("api/driver/notifications/{id}/read")
    Call<ApiResponse> markNotificationRead(@Path("id") int notiId);

    @DELETE("api/driver/notifications/{id}")
    Call<ApiResponse> deleteNotification(@Path("id") int notiId);

    class EarningsResponse {
        public java.math.BigDecimal todayEarnings;
        public int totalOrders;
    }

    class OrderStatusRequest {
        public String status;
        public OrderStatusRequest(String status) {
            this.status = status;
        }
    }

    class CancelRequest {
        private String cancellation_Reason;
        public CancelRequest(String reason) { this.cancellation_Reason = reason; }
    }

    class ComplaintRequest {
        private String description;
        public ComplaintRequest(String description) { this.description = description; }
    }
}
