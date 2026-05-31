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

    @GET("api/driver/orders/{id}")
    Call<Order> getOrderById(@Path("id") int orderId);

    @POST("api/driver/orders/{id}/cancel")
    Call<ApiResponse> cancelOrder(@Path("id") int orderId, @Body CancelRequest request);

    @POST("api/driver/orders/{id}/complaint")
    Call<ApiResponse> reportComplaint(@Path("id") int orderId, @Body ComplaintRequest request);

    @retrofit2.http.Multipart
    @POST("api/driver/orders/{id}/complaint")
    Call<ApiResponse> reportComplaintWithImages(
            @Path("id") int orderId, 
            @retrofit2.http.Part("description") okhttp3.RequestBody description,
            @retrofit2.http.Part java.util.List<okhttp3.MultipartBody.Part> issue_images
    );

    @GET("api/driver/earnings/today")
    Call<EarningsResponse> getTodayEarnings();

    @GET("api/driver/statistics")
    Call<StatisticsResponse> getStatistics(@retrofit2.http.Query("filter") String filter);

    @GET("api/driver/notifications")
    Call<java.util.List<com.example.shipper_app.model.Notification>> getNotifications();

    @PUT("api/driver/notifications/{id}/read")
    Call<ApiResponse> markNotificationRead(@Path("id") int notiId);

    @DELETE("api/driver/notifications/{id}")
    Call<ApiResponse> deleteNotification(@Path("id") int notiId);

    @GET("api/driver/complaints")
    Call<ComplaintResponse> getComplaints();

    @PUT("api/driver/complaints/{id}/withdraw")
    Call<ApiResponse> withdrawComplaint(@Path("id") int complaintId, @Body WithdrawRequest request);

    @GET("api/driver/profile")
    Call<ProfileResponse> getProfile();

    @PUT("api/driver/profile")
    Call<ApiResponse> updateProfile(@Body ProfileRequest request);

    @retrofit2.http.Multipart
    @PUT("api/driver/profile")
    Call<ApiResponse> updateProfileWithAvatar(
            @retrofit2.http.Part("fullName") okhttp3.RequestBody fullName,
            @retrofit2.http.Part("email") okhttp3.RequestBody email,
            @retrofit2.http.Part("phone") okhttp3.RequestBody phone,
            @retrofit2.http.Part("license_plate") okhttp3.RequestBody licensePlate,
            @retrofit2.http.Part okhttp3.MultipartBody.Part avatar
    );

    @GET("api/driver/chat/conversations")
    Call<List<ChatConversationResponse>> getConversations();

    class ChatConversationResponse {
        public int partner_id;
        public String partner_name;
        public String partner_role;
        public String lastMessage;
        public String time;
        public boolean is_read;
        public int sender_id;
        public String orderId;
    }

    @GET("api/driver/chat/messages/{partnerId}")
    Call<List<ChatMessageResponse>> getMessages(@Path("partnerId") int partnerId);

    @POST("api/driver/chat/messages")
    Call<ApiResponse> sendMessage(@Body SendMessageRequest request);

    @PUT("api/driver/chat/messages/{partnerId}/read")
    Call<ApiResponse> markMessagesAsRead(@Path("partnerId") int partnerId);

    @GET("api/driver/wallet")
    Call<com.example.shipper_app.model.WalletResponse> getWallet();

    @POST("api/driver/wallet/deposit")
    Call<ApiResponse> depositWallet(@Body java.util.Map<String, Double> request);

    @POST("api/driver/wallet/withdraw")
    Call<ApiResponse> withdrawWallet(@Body java.util.Map<String, Double> request);

    class ChatMessageResponse {
        public int id_Message;
        public int sender_id;
        public int receiver_id;
        public String message_text;
        public String created_at;
        public boolean is_read;
    }

    class SendMessageRequest {
        public int receiver_id;
        public String message_text;
        public SendMessageRequest(int receiver_id, String message_text) {
            this.receiver_id = receiver_id;
            this.message_text = message_text;
        }
    }

    class ComplaintResponse {
        public List<com.example.shipper_app.model.Complaint> myComplaints;
        public List<com.example.shipper_app.model.Complaint> complaintsAboutMe;
    }

    class EarningsResponse {
        public java.math.BigDecimal todayEarnings;
        public int totalOrders;
    }

    class StatisticsResponse {
        public java.math.BigDecimal totalEarnings;
        public int completedOrders;
        public int cancelledOrders;
        public float ratingAvg;
        public int activeHours;
        public List<OrderHistory> history;
    }

    class OrderHistory {
        public int id_Order;
        public String order_Status;
        public java.math.BigDecimal shipping_Fee;
        public String payment_Method;
        public String delivered_At;
        public String created_At;
        public String cancelled_By;
        public String full_Address;
        public String name_Restaurant;
        public String fullName;
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

    class WithdrawRequest {
        private String resolution;
        public WithdrawRequest(String resolution) { this.resolution = resolution; }
    }

    class ProfileResponse {
        public int id_User;
        public String phone;
        public String fullName;
        public String email;
        public String avatar;
        public String license_plate;
        public float rating_Avg;
        public int driver_total_orders;
    }

    class ProfileRequest {
        public String fullName;
        public String email;
        public String phone;
        public String license_plate;
        public ProfileRequest(String fullName, String email, String phone, String license_plate) {
            this.fullName = fullName;
            this.email = email;
            this.phone = phone;
            this.license_plate = license_plate;
        }
    }
}
