package com.example.shipper_app.model;

import com.google.gson.annotations.SerializedName;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.Date;
import java.util.List;

/**
 * Model Order - ánh xạ với bảng Order trong ERD
 * Chứa các thông tin cần thiết cho màn hình shipper
 */
public class Order implements Serializable {

    // Trạng thái đơn hàng (ánh xạ ENUM order_Status trong ERD)
    public enum OrderStatus {
        PENDING("Chờ xác nhận"),
        CONFIRMED("Đã xác nhận"),
        PREPARING("Đang chuẩn bị"),
        WAITING_PICKUP("Chờ lấy hàng"),
        PICKING_UP("Đang lấy hàng"),
        DELIVERING("Đang giao hàng"),
        DELIVERED("Đã giao hàng"),
        CANCELLED("Đã hủy"),
        FAILED("Giao thất bại");

        private final String displayName;

        OrderStatus(String displayName) {
            this.displayName = displayName;
        }

        public String getDisplayName() {
            return displayName;
        }
    }

    // Phương thức thanh toán
    public enum PaymentMethod {
        COD("Tiền mặt"),
        ONLINE("Thanh toán online");

        private final String displayName;

        PaymentMethod(String displayName) {
            this.displayName = displayName;
        }

        public String getDisplayName() {
            return displayName;
        }
    }

    // ====== Các trường từ ERD ======
    @SerializedName("id_Order")
    private int idOrder;
    
    @SerializedName("id_Restaurant")
    private int idRestaurant;
    
    @SerializedName("id_Driver")
    private Integer idDriver; // Có thể null
    
    @SerializedName("id_User")
    private int idUser;
    
    @SerializedName("res_owner_id")
    private Integer resOwnerId;
    
    @SerializedName("order_Code")
    private String orderCode;           // order_Code
    
    @SerializedName("total_Amount")
    private BigDecimal totalAmount;     // total_Amount
    
    @SerializedName("shipping_Fee")
    private BigDecimal shipFee;         // shipping_Fee
    
    @SerializedName("shipper_Earned")
    private BigDecimal shipperEarned;   // shipping fee actual earned by shipper
    
    @SerializedName("discount_Amount")
    private BigDecimal discountAmount;  // discount_Amount
    
    @SerializedName("payment_Method")
    private String paymentMethod; // payment_Method (dạng String từ JSON)
    
    @SerializedName("order_Status")
    private String orderStatus;    // order_Status (dạng String từ JSON)
    
    @SerializedName("payment_Status")
    private String paymentStatus;
    
    @SerializedName("food_Amount")
    private BigDecimal foodAmount;
    
    @SerializedName("note")
    private String note;                // note
    
    @SerializedName("ready_At")
    private Date readyAt;
    
    @SerializedName("picked_UpAt")
    private Date pickedAt;
    
    @SerializedName("delivered_At")
    private Date deliveredAt;
    
    @SerializedName("created_At")
    private Date createdAt;
    
    @SerializedName("accepted_At")
    private Date acceptedAt;

    // Tính toán từ SQL
    @SerializedName("expected_Completion_Time")
    private Date expectedCompletionTime;

    // ====== Thông tin bổ sung cho UI (JOIN với các bảng khác) ======
    @SerializedName("name_Restaurant")
    private String restaurantName;      // Tên nhà hàng / điểm lấy hàng
    
    @SerializedName("res_address")
    private String pickupAddress;       // Địa chỉ lấy hàng (từ bảng Address qua Restaurant)
    
    @SerializedName("user_address")
    private String deliveryAddress;     // Địa chỉ giao hàng (từ bảng Address qua User)
    
    @SerializedName("user_name")
    private String customerName;        // Tên khách hàng (từ bảng User)
    
    @SerializedName("user_phone")
    private String customerPhone;       // SĐT khách hàng
    
    private float distanceKm;          // Khoảng cách tính toán (giữ nguyên, tự tính trên app nếu cần)
    private boolean isExpress;         // Express order

    @SerializedName("items")
    private List<OrderItem> items;     // Danh sách món ăn

    // ====== Constructors ======

    public Order() {}

    /**
     * Constructor đầy đủ để dùng trong demo/mock data
     */
    public Order(int idOrder, String orderCode, String restaurantName,
                 String pickupAddress, String deliveryAddress,
                 String customerName, String customerPhone,
                 BigDecimal totalAmount, BigDecimal shipFee,
                 float distanceKm, String orderStatus, String note) {
        this.idOrder = idOrder;
        this.orderCode = orderCode;
        this.restaurantName = restaurantName;
        this.pickupAddress = pickupAddress;
        this.deliveryAddress = deliveryAddress;
        this.customerName = customerName;
        this.customerPhone = customerPhone;
        this.totalAmount = totalAmount;
        this.shipFee = shipFee;
        this.distanceKm = distanceKm;
        this.orderStatus = orderStatus;
        this.note = note;
    }

    // ====== Getters & Setters ======

    public int getIdOrder() { return idOrder; }
    public void setIdOrder(int idOrder) { this.idOrder = idOrder; }

    public int getIdRestaurant() { return idRestaurant; }
    public void setIdRestaurant(int idRestaurant) { this.idRestaurant = idRestaurant; }

    public Integer getIdDriver() { return idDriver; }
    public void setIdDriver(Integer idDriver) { this.idDriver = idDriver; }

    public int getIdUser() { return idUser; }
    public void setIdUser(int idUser) { this.idUser = idUser; }
    
    public Integer getResOwnerId() { return resOwnerId; }
    public void setResOwnerId(Integer resOwnerId) { this.resOwnerId = resOwnerId; }

    public String getOrderCode() { return orderCode; }
    public void setOrderCode(String orderCode) { this.orderCode = orderCode; }

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

    public BigDecimal getShipFee() { return shipFee; }
    public void setShipFee(BigDecimal shipFee) { this.shipFee = shipFee; }

    public BigDecimal getShipperEarned() { return shipperEarned; }
    public void setShipperEarned(BigDecimal shipperEarned) { this.shipperEarned = shipperEarned; }

    public BigDecimal getDiscountAmount() { return discountAmount; }
    public void setDiscountAmount(BigDecimal discountAmount) { this.discountAmount = discountAmount; }

    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public String getOrderStatus() { return orderStatus; }
    public void setOrderStatus(String orderStatus) { this.orderStatus = orderStatus; }

    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public BigDecimal getFoodAmount() { return foodAmount; }
    public void setFoodAmount(BigDecimal foodAmount) { this.foodAmount = foodAmount; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public Date getReadyAt() { return readyAt; }
    public void setReadyAt(Date readyAt) { this.readyAt = readyAt; }

    public Date getPickedAt() { return pickedAt; }
    public void setPickedAt(Date pickedAt) { this.pickedAt = pickedAt; }

    public Date getDeliveredAt() { return deliveredAt; }
    public void setDeliveredAt(Date deliveredAt) { this.deliveredAt = deliveredAt; }

    public Date getCreatedAt() { return createdAt; }
    public void setCreatedAt(Date createdAt) { this.createdAt = createdAt; }

    public Date getAcceptedAt() { return acceptedAt; }
    public void setAcceptedAt(Date acceptedAt) { this.acceptedAt = acceptedAt; }

    public Date getExpectedCompletionTime() { return expectedCompletionTime; }
    public void setExpectedCompletionTime(Date expectedCompletionTime) { this.expectedCompletionTime = expectedCompletionTime; }

    public String getRestaurantName() { return restaurantName; }
    public void setRestaurantName(String restaurantName) { this.restaurantName = restaurantName; }

    public String getPickupAddress() { return pickupAddress; }
    public void setPickupAddress(String pickupAddress) { this.pickupAddress = pickupAddress; }

    public String getDeliveryAddress() { return deliveryAddress; }
    public void setDeliveryAddress(String deliveryAddress) { this.deliveryAddress = deliveryAddress; }

    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }

    public String getCustomerPhone() { return customerPhone; }
    public void setCustomerPhone(String customerPhone) { this.customerPhone = customerPhone; }

    public float getDistanceKm() { return distanceKm; }
    public void setDistanceKm(float distanceKm) { this.distanceKm = distanceKm; }

    public boolean isExpress() { return isExpress; }
    public void setExpress(boolean express) { isExpress = express; }

    public List<OrderItem> getItems() { return items; }
    public void setItems(List<OrderItem> items) { this.items = items; }

    /**
     * Lấy chữ cái đầu của tên khách hàng để hiển thị avatar
     */
    public String getCustomerInitial() {
        if (customerName != null && !customerName.isEmpty()) {
            // Lấy từ cuối (tên tiếng Việt thường tên ở cuối)
            String[] parts = customerName.split(" ");
            if (parts.length > 0) {
                String lastName = parts[parts.length - 1];
                return String.valueOf(lastName.charAt(0)).toUpperCase();
            }
        }
        return "?";
    }

    /**
     * Format khoảng cách hiển thị
     */
    public String getDistanceDisplay() {
        if (distanceKm < 1) {
            return String.format("%.0f m", distanceKm * 1000);
        }
        return String.format("%.1f km", distanceKm);
    }

    /**
     * Format tiền tệ VNĐ
     */
    public static String formatCurrency(BigDecimal amount) {
        if (amount == null) return "0 đ";
        java.text.NumberFormat formatter = java.text.NumberFormat.getNumberInstance(new java.util.Locale("vi", "VN"));
        return formatter.format(amount) + " đ";
    }
}
