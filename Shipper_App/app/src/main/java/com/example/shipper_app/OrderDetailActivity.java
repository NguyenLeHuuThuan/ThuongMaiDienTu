package com.example.shipper_app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;

import com.example.shipper_app.api.ApiClient;
import com.example.shipper_app.api.ApiService;
import com.example.shipper_app.model.Order;
import com.example.shipper_app.model.api.ApiResponse;
import com.google.android.material.button.MaterialButton;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * OrderDetailActivity - Màn hình chi tiết đơn hàng
 * Hiển thị: trạng thái, lộ trình, khách hàng, thanh toán
 * Ánh xạ với activity_order_detail.xml
 */
public class OrderDetailActivity extends AppCompatActivity {

    // Views
    private TextView tvOrderCode;
    private TextView tvStatusBadge;
    private TextView tvExpressBadge;
    private TextView tvCurrentStatus;
    private TextView tvReadyStatus;
    private TextView tvReceivedTime;
    private TextView tvDistance;
    private TextView tvPickupName;
    private TextView tvPickupAddress;
    private TextView tvDeliveryName;
    private TextView tvDeliveryAddress;
    private TextView tvCustomerInitial;
    private TextView tvCustomerName;
    private TextView tvCustomerPhone;
    private TextView tvCustomerNote;
    private TextView tvCodAmount;
    private LinearLayout layoutPaymentPending;
    private LinearLayout layoutCodRow;
    private LinearLayout layoutCodDetails;
    private android.widget.ImageView ivCodExpand;
    private TextView tvFoodAmount;
    private TextView tvShipFeeDetail;
    private TextView tvShipFeeCustomer;
    private TextView tvDiscountAmount;
    
    private LinearLayout layoutPaymentPaid;
    private TextView tvShipFeeEarned;
    private LinearLayout layoutNote;
    private LinearLayout layoutItemsHeader;
    private android.widget.ImageView ivItemsExpand;
    private LinearLayout layoutItemsContainer;
    private MaterialButton btnMainAction;
    private ImageButton btnBack;
    private ImageButton btnCallCustomer;
    private ImageButton btnMessageCustomer;
    private ImageButton btnMessageRestaurant;
    private ImageButton btnReportProblem;

    private Order currentOrder;
    private final ActivityResultLauncher<Intent> issueLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (result.getResultCode() == RESULT_OK) {
                    finish();
                }
            }
    );
    private static final SimpleDateFormat TIME_FORMAT =
            new SimpleDateFormat("HH:mm", Locale.getDefault());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_order_detail);

        // Nhận dữ liệu đơn hàng từ HomeActivity
        currentOrder = (Order) getIntent().getSerializableExtra(HomeActivity.EXTRA_ORDER);

        if (currentOrder == null) {
            Toast.makeText(this, "Không tìm thấy thông tin đơn hàng", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        initViews();
        populateData();
        setupClickListeners();
    }

    private void initViews() {
        tvOrderCode = findViewById(R.id.tv_order_code);
        tvExpressBadge = findViewById(R.id.tv_express_badge);
        tvCurrentStatus = findViewById(R.id.tv_current_status);
        tvReadyStatus = findViewById(R.id.tv_ready_status);
        tvReceivedTime = findViewById(R.id.tv_received_time);
        tvDistance = findViewById(R.id.tv_distance);
        tvPickupName = findViewById(R.id.tv_pickup_name);
        tvPickupAddress = findViewById(R.id.tv_pickup_address);
        tvDeliveryName = findViewById(R.id.tv_delivery_name);
        tvDeliveryAddress = findViewById(R.id.tv_delivery_address);
        tvCustomerInitial = findViewById(R.id.tv_customer_initial);
        tvCustomerName = findViewById(R.id.tv_customer_name);
        tvCustomerPhone = findViewById(R.id.tv_customer_phone);
        tvCustomerNote = findViewById(R.id.tv_customer_note);
        tvCodAmount = findViewById(R.id.tv_cod_amount);
        layoutPaymentPending = findViewById(R.id.layout_payment_pending);
        layoutCodRow = findViewById(R.id.layout_cod_row);
        layoutCodDetails = findViewById(R.id.layout_cod_details);
        ivCodExpand = findViewById(R.id.iv_cod_expand);
        tvFoodAmount = findViewById(R.id.tv_food_amount);
        tvShipFeeCustomer = findViewById(R.id.tv_ship_fee_customer);
        tvShipFeeDetail = findViewById(R.id.tv_ship_fee_detail);
        tvDiscountAmount = findViewById(R.id.tv_discount_amount);
        layoutPaymentPaid = findViewById(R.id.layout_payment_paid);
        tvShipFeeEarned = findViewById(R.id.tv_ship_fee_earned);
        layoutNote = findViewById(R.id.layout_note);
        layoutItemsHeader = findViewById(R.id.layout_items_header);
        ivItemsExpand = findViewById(R.id.iv_items_expand);
        layoutItemsContainer = findViewById(R.id.layout_items_container);
        btnMainAction = findViewById(R.id.btn_main_action);
        btnBack = findViewById(R.id.btn_back);
        btnCallCustomer = findViewById(R.id.btn_call_customer);
        btnMessageCustomer = findViewById(R.id.btn_message_customer);
        btnMessageRestaurant = findViewById(R.id.btn_message_restaurant);
        btnReportProblem = findViewById(R.id.btn_report_problem);
        
        // Hide actions if read only mode
        boolean isReadOnly = getIntent().getBooleanExtra("EXTRA_READ_ONLY", false);
        if (isReadOnly) {
            View layoutBottomAction = findViewById(R.id.layout_bottom_action);
            if (layoutBottomAction != null) {
                layoutBottomAction.setVisibility(View.GONE);
            }
            btnCallCustomer.setVisibility(View.GONE);
            btnMessageCustomer.setVisibility(View.GONE);
            btnMessageRestaurant.setVisibility(View.GONE);
        }
    }

    /**
     * Đổ dữ liệu đơn hàng lên UI
     */
    private void populateData() {
        // ===== Header =====
        tvOrderCode.setText("Đơn hàng #" + currentOrder.getOrderCode());

        // Badge Express
        if (currentOrder.isExpress()) {
            tvExpressBadge.setVisibility(View.VISIBLE);
        } else {
            tvExpressBadge.setVisibility(View.GONE);
        }

        // ===== Trạng thái =====
        updateStatusUI();

        // Thời gian nhận đơn và dự kiến hoàn thành
        String actionTimeStr = "--:--";
        String actionPrefix = "Tạo lúc ";
        String estTimeStr = "--:--";

        String status = currentOrder.getOrderStatus();
        if (status == null) status = "";
        
        if (status.equalsIgnoreCase("delivered")) {
            actionPrefix = "Giao hàng lúc ";
            if (currentOrder.getDeliveredAt() != null) {
                actionTimeStr = TIME_FORMAT.format(currentOrder.getDeliveredAt());
            } else if (currentOrder.getAcceptedAt() != null) {
                actionTimeStr = TIME_FORMAT.format(currentOrder.getAcceptedAt());
                actionPrefix = "Nhận lúc ";
            }
        } else if (status.equalsIgnoreCase("delivering")) {
            actionPrefix = "Lấy hàng lúc ";
            if (currentOrder.getPickedAt() != null) {
                actionTimeStr = TIME_FORMAT.format(currentOrder.getPickedAt());
            } else if (currentOrder.getAcceptedAt() != null) {
                actionTimeStr = TIME_FORMAT.format(currentOrder.getAcceptedAt());
                actionPrefix = "Nhận lúc ";
            }
        } else if (status.equalsIgnoreCase("picking") || status.equalsIgnoreCase("waiting_pickup")) {
            actionPrefix = "Nhận lúc ";
            if (currentOrder.getAcceptedAt() != null) {
                actionTimeStr = TIME_FORMAT.format(currentOrder.getAcceptedAt());
            } else if (currentOrder.getCreatedAt() != null) {
                actionTimeStr = TIME_FORMAT.format(currentOrder.getCreatedAt());
                actionPrefix = "Tạo lúc ";
            }
        } else {
            // confirmed, pending
            actionPrefix = "Tạo lúc ";
            if (currentOrder.getCreatedAt() != null) {
                actionTimeStr = TIME_FORMAT.format(currentOrder.getCreatedAt());
            }
        }

        if (currentOrder.getExpectedCompletionTime() != null) {
            estTimeStr = TIME_FORMAT.format(currentOrder.getExpectedCompletionTime());
        }
        
        if (status.equalsIgnoreCase("delivered")) {
            tvReceivedTime.setText(" " + actionPrefix + actionTimeStr);
        } else {
            tvReceivedTime.setText(" " + actionPrefix + actionTimeStr + " · Dự kiến hoàn thành " + estTimeStr);
        }

        // ===== Lộ trình =====
        if (tvDistance != null) {
            tvDistance.setText(currentOrder.getDistanceDisplay());
        }
        
        // Điểm lấy hàng
        String pickupName = currentOrder.getRestaurantName();
        tvPickupName.setText(pickupName != null ? pickupName : "Điểm lấy hàng");
        tvPickupAddress.setText(currentOrder.getPickupAddress());

        // Dynamic visibility for restaurant message button
        if (currentOrder.getResOwnerId() == null || currentOrder.getResOwnerId() == 0) {
            btnMessageRestaurant.setVisibility(View.GONE);
        } else {
            boolean isReadOnly = getIntent().getBooleanExtra("EXTRA_READ_ONLY", false);
            if (!isReadOnly) {
                btnMessageRestaurant.setVisibility(View.VISIBLE);
            }
        }

        // Điểm giao hàng - địa chỉ giao hàng (chỉ có địa chỉ, không có tên)
        tvDeliveryName.setText("Điểm giao hàng");
        tvDeliveryAddress.setText(currentOrder.getDeliveryAddress());

        // ===== Khách hàng =====
        tvCustomerInitial.setText(currentOrder.getCustomerInitial());
        tvCustomerName.setText(currentOrder.getCustomerName());
        tvCustomerPhone.setText(currentOrder.getCustomerPhone());

        // Ghi chú
        String note = currentOrder.getNote();
        if (note != null && !note.isEmpty()) {
            layoutNote.setVisibility(View.VISIBLE);
            tvCustomerNote.setText("\"" + note + "\"");
        } else {
            layoutNote.setVisibility(View.GONE);
        }

        // ===== Danh sách món ăn =====
        if (currentOrder.getItems() != null && !currentOrder.getItems().isEmpty()) {
            layoutItemsContainer.removeAllViews();
            for (com.example.shipper_app.model.OrderItem item : currentOrder.getItems()) {
                LinearLayout itemLayout = new LinearLayout(this);
                itemLayout.setOrientation(LinearLayout.HORIZONTAL);
                itemLayout.setPadding(0, 0, 0, 16);
                
                TextView tvQuantity = new TextView(this);
                tvQuantity.setText(item.getQuantity() + "x");
                tvQuantity.setTextSize(14);
                tvQuantity.setTextColor(getResources().getColor(R.color.color_primary));
                tvQuantity.setTypeface(null, android.graphics.Typeface.BOLD);
                tvQuantity.setPadding(0, 0, 24, 0);
                
                LinearLayout nameNoteLayout = new LinearLayout(this);
                nameNoteLayout.setOrientation(LinearLayout.VERTICAL);
                LinearLayout.LayoutParams nameParams = new LinearLayout.LayoutParams(
                        0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f);
                nameNoteLayout.setLayoutParams(nameParams);

                TextView tvName = new TextView(this);
                tvName.setText(item.getName());
                tvName.setTextSize(14);
                tvName.setTextColor(getResources().getColor(R.color.color_text_primary));
                nameNoteLayout.addView(tvName);

                if (item.getNote() != null && !item.getNote().trim().isEmpty()) {
                    TextView tvNote = new TextView(this);
                    tvNote.setText("Ghi chú: " + item.getNote());
                    tvNote.setTextSize(12);
                    tvNote.setTextColor(getResources().getColor(R.color.color_text_secondary));
                    tvNote.setTypeface(null, android.graphics.Typeface.ITALIC);
                    nameNoteLayout.addView(tvNote);
                }
                
                TextView tvPrice = new TextView(this);
                tvPrice.setText(Order.formatCurrency(item.getPrice()));
                tvPrice.setTextSize(14);
                tvPrice.setTextColor(getResources().getColor(R.color.color_text_secondary));
                
                itemLayout.addView(tvQuantity);
                itemLayout.addView(nameNoteLayout);
                itemLayout.addView(tvPrice);
                
                layoutItemsContainer.addView(itemLayout);
            }
        } else {
            TextView tvEmpty = new TextView(this);
            tvEmpty.setText("Không có dữ liệu món ăn");
            tvEmpty.setTextColor(getResources().getColor(R.color.color_text_secondary));
            layoutItemsContainer.addView(tvEmpty);
        }

        // ===== Thanh toán =====
        if ("paid".equalsIgnoreCase(currentOrder.getPaymentStatus())) {
            layoutPaymentPending.setVisibility(View.GONE);
            layoutPaymentPaid.setVisibility(View.VISIBLE);
            
            if (currentOrder.getShipperEarned() != null) {
                tvShipFeeEarned.setText(Order.formatCurrency(currentOrder.getShipperEarned()));
            } else if (currentOrder.getShipFee() != null) {
                tvShipFeeEarned.setText(Order.formatCurrency(currentOrder.getShipFee()));
            } else {
                tvShipFeeEarned.setText("0 đ");
            }
        } else {
            layoutPaymentPending.setVisibility(View.VISIBLE);
            layoutPaymentPaid.setVisibility(View.GONE);
            
            if (currentOrder.getTotalAmount() != null) {
                tvCodAmount.setText(Order.formatCurrency(currentOrder.getTotalAmount()));
            } else {
                tvCodAmount.setText("0 đ");
            }
            
            if (currentOrder.getFoodAmount() != null) {
                tvFoodAmount.setText(Order.formatCurrency(currentOrder.getFoodAmount()));
            } else {
                tvFoodAmount.setText("0 đ");
            }
            
            if (currentOrder.getShipFee() != null) {
                tvShipFeeCustomer.setText(Order.formatCurrency(currentOrder.getShipFee()));
            } else {
                tvShipFeeCustomer.setText("0 đ");
            }
            

            if (currentOrder.getShipperEarned() != null) {
                tvShipFeeDetail.setText(Order.formatCurrency(currentOrder.getShipperEarned()));
            } else if (currentOrder.getShipFee() != null) {
                tvShipFeeDetail.setText(Order.formatCurrency(currentOrder.getShipFee()));
            } else {
                tvShipFeeDetail.setText("0 đ");
            }
            
            if (currentOrder.getDiscountAmount() != null) {
                tvDiscountAmount.setText(Order.formatCurrency(currentOrder.getDiscountAmount()));
            } else {
                tvDiscountAmount.setText("0 đ");
            }
            
            // Expand/Collapse logic
            layoutCodRow.setOnClickListener(v -> {
                if (layoutCodDetails.getVisibility() == View.VISIBLE) {
                    layoutCodDetails.setVisibility(View.GONE);
                    ivCodExpand.animate().rotation(0).setDuration(200).start();
                } else {
                    layoutCodDetails.setVisibility(View.VISIBLE);
                    ivCodExpand.animate().rotation(180).setDuration(200).start();
                }
            });
        }
    }

    /**
     * Cập nhật UI theo trạng thái đơn hàng
     */
    private void updateStatusUI() {
        if (currentOrder.getOrderStatus() == null) return;

        String status = currentOrder.getOrderStatus();
        boolean hasDriver = currentOrder.getIdDriver() != null && currentOrder.getIdDriver() != 0;

        if ("picking".equals(status) || "WAITING_PICKUP".equals(status) || "PICKING_UP".equals(status) ||
            ("ready".equalsIgnoreCase(status) && hasDriver)) {
            if ("ready".equalsIgnoreCase(status)) {
                tvCurrentStatus.setText("Đang lấy hàng (Món ăn đã sẵn sàng)");
            } else {
                tvCurrentStatus.setText("Đang lấy hàng");
            }
            btnMainAction.setText("Đã lấy hàng");
            btnMainAction.setEnabled(true);
            btnReportProblem.setVisibility(View.VISIBLE);
        } else if ("delivering".equals(status) || "DELIVERING".equals(status)) {
            tvCurrentStatus.setText("Đang giao hàng");
            btnMainAction.setText("Đã giao hàng");
            btnMainAction.setEnabled(true);
            btnReportProblem.setVisibility(View.VISIBLE);
        } else if ("delivered".equals(status) || "DELIVERED".equals(status)) {
            tvCurrentStatus.setText("Đã giao hàng thành công");
            btnMainAction.setText("Hoàn thành");
            btnMainAction.setEnabled(false);
            btnReportProblem.setVisibility(View.VISIBLE);
        } else if ("confirmed".equalsIgnoreCase(status) || "preparing".equalsIgnoreCase(status) || 
                   ("ready".equalsIgnoreCase(status) && !hasDriver)) {
            if ("confirmed".equalsIgnoreCase(status)) {
                tvCurrentStatus.setText("Đã xác nhận");
            } else if ("preparing".equalsIgnoreCase(status)) {
                tvCurrentStatus.setText("Đang chuẩn bị");
            } else if ("ready".equalsIgnoreCase(status)) {
                tvCurrentStatus.setText("Món ăn đã sẵn sàng");
            } else {
                tvCurrentStatus.setText(status);
            }
            btnMainAction.setText("Nhận đơn");
            btnMainAction.setEnabled(true);
            btnReportProblem.setVisibility(View.GONE);
        } else {
            tvCurrentStatus.setText(status);
            btnMainAction.setText("Cập nhật trạng thái");
            btnMainAction.setEnabled(true);
            btnReportProblem.setVisibility(View.VISIBLE);
        }

        if (currentOrder.getReadyAt() != null) {
            String lowerStatus = status.toLowerCase();
            if (lowerStatus.equals("pending") || 
                lowerStatus.equals("preparing") || 
                lowerStatus.equals("delivering") || 
                lowerStatus.equals("delivered")) {
                tvReadyStatus.setVisibility(View.GONE);
            } else {
                tvReadyStatus.setVisibility(View.VISIBLE);
            }
        } else {
            tvReadyStatus.setVisibility(View.GONE);
        }
    }

    private void setupClickListeners() {
        // Nút quay lại
        btnBack.setOnClickListener(v -> {
            finish();
            overridePendingTransition(android.R.anim.slide_in_left, android.R.anim.slide_out_right);
        });

        // Nút hành động chính (Đã lấy hàng / Đã giao hàng)
        btnMainAction.setOnClickListener(v -> {
            handleMainAction();
        });

        // Nút gọi điện khách hàng
        btnCallCustomer.setOnClickListener(v -> {
            String phone = currentOrder.getCustomerPhone();
            if (phone != null && !phone.isEmpty()) {
                Intent callIntent = new Intent(Intent.ACTION_DIAL);
                callIntent.setData(Uri.parse("tel:" + phone.replaceAll("[^0-9]", "")));
                startActivity(callIntent);
            }
        });

        // Nút nhắn tin khách hàng
        btnMessageCustomer.setOnClickListener(v -> {
            Intent chatIntent = new Intent(OrderDetailActivity.this, ChatDetailActivity.class);
            chatIntent.putExtra("PARTNER_ID", currentOrder.getIdUser());
            chatIntent.putExtra("PARTNER_NAME", currentOrder.getCustomerName());
            chatIntent.putExtra("DEFAULT_MESSAGE", 
                "Xin chào " + currentOrder.getCustomerName() + 
                ", tôi là shipper đang giao đơn hàng #" + currentOrder.getOrderCode() + " của bạn.");
            startActivity(chatIntent);
        });

        // Nút nhắn tin nhà hàng
        btnMessageRestaurant.setOnClickListener(v -> {
            if (currentOrder.getResOwnerId() != null && currentOrder.getResOwnerId() != 0) {
                Intent chatIntent = new Intent(OrderDetailActivity.this, ChatDetailActivity.class);
                chatIntent.putExtra("PARTNER_ID", currentOrder.getResOwnerId().intValue());
                chatIntent.putExtra("PARTNER_NAME", currentOrder.getRestaurantName());
                chatIntent.putExtra("DEFAULT_MESSAGE", 
                    "Xin chào nhà hàng " + currentOrder.getRestaurantName() + 
                    ", tôi là shipper đang xử lý đơn hàng #" + currentOrder.getOrderCode() + ".");
                startActivity(chatIntent);
            } else {
                Toast.makeText(OrderDetailActivity.this, "Không thể bắt đầu cuộc trò chuyện với nhà hàng này", Toast.LENGTH_SHORT).show();
            }
        });

        // Nút báo cáo sự cố
        btnReportProblem.setOnClickListener(v -> {
            showReportProblemDialog();
        });

        // Toggle danh sách món ăn
        if (layoutItemsHeader != null) {
            layoutItemsHeader.setOnClickListener(v -> {
                if (layoutItemsContainer.getVisibility() == View.VISIBLE) {
                    layoutItemsContainer.setVisibility(View.GONE);
                    ivItemsExpand.animate().rotation(0).setDuration(200).start();
                } else {
                    layoutItemsContainer.setVisibility(View.VISIBLE);
                    ivItemsExpand.animate().rotation(180).setDuration(200).start();
                }
            });
        }
    }

    /**
     * Xử lý hành động chính theo trạng thái đơn hàng
     */
    private void handleMainAction() {
        String current = currentOrder.getOrderStatus();
        String nextStatus = "";
        boolean hasDriver = currentOrder.getIdDriver() != null && currentOrder.getIdDriver() != 0;

        if ("picking".equals(current) || "WAITING_PICKUP".equals(current) || "PICKING_UP".equals(current) ||
            ("ready".equalsIgnoreCase(current) && hasDriver)) {
            // Đã lấy hàng xong, chuyển sang Đang giao
            nextStatus = "delivering";
        } else if ("delivering".equals(current) || "DELIVERING".equals(current)) {
            // Đã giao hàng thành công
            showConfirmDeliveredDialog();
            return;
        } else if ("confirmed".equalsIgnoreCase(current) || "preparing".equalsIgnoreCase(current) || 
                   ("ready".equalsIgnoreCase(current) && !hasDriver)) {
            // Tài xế nhận đơn
            acceptOrderApi();
            return;
        } else {
            return;
        }

        updateStatusApi(nextStatus);
    }

    private void acceptOrderApi() {
        btnMainAction.setEnabled(false);
        ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
        apiService.acceptOrder(currentOrder.getIdOrder()).enqueue(new Callback<ApiResponse>() {
            @Override
            public void onResponse(Call<ApiResponse> call, Response<ApiResponse> response) {
                btnMainAction.setEnabled(true);
                if (response.isSuccessful()) {
                    currentOrder.setOrderStatus("picking");
                    java.util.Date now = new java.util.Date();
                    currentOrder.setAcceptedAt(now);
                    currentOrder.setExpectedCompletionTime(new java.util.Date(now.getTime() + 15 * 60 * 1000));
                    updateStatusUI();
                    
                    String actionTimeStr = TIME_FORMAT.format(now);
                    String estTimeStr = TIME_FORMAT.format(currentOrder.getExpectedCompletionTime());
                    tvReceivedTime.setText(" Nhận lúc " + actionTimeStr + " · Dự kiến hoàn thành " + estTimeStr);
                    
                    com.example.shipper_app.utils.NotificationHelper.showTopPopup(OrderDetailActivity.this, 
                        "🔔 Thông báo mới", 
                        "Bạn đã nhận giao đơn hàng #" + currentOrder.getIdOrder());
                } else {
                    try {
                        String errorMsg = "Không thể nhận đơn hàng này";
                        if (response.errorBody() != null) {
                            String errorBodyStr = response.errorBody().string();
                            org.json.JSONObject errorJson = new org.json.JSONObject(errorBodyStr);
                            if (errorJson.has("message")) {
                                errorMsg = errorJson.getString("message");
                            }
                        }
                        Toast.makeText(OrderDetailActivity.this, errorMsg, Toast.LENGTH_LONG).show();
                    } catch (Exception e) {
                        Toast.makeText(OrderDetailActivity.this, "Không thể nhận đơn hàng này", Toast.LENGTH_SHORT).show();
                    }
                    // Đóng Activity để về Home tải lại danh sách nếu lỗi (ví dụ không đủ số dư ví)
                    finish();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse> call, Throwable t) {
                btnMainAction.setEnabled(true);
                Toast.makeText(OrderDetailActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void updateStatusApi(String newStatus) {
        btnMainAction.setEnabled(false);
        ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
        ApiService.OrderStatusRequest request = new ApiService.OrderStatusRequest(newStatus);
        
        apiService.updateOrderStatus(currentOrder.getIdOrder(), request).enqueue(new Callback<ApiResponse>() {
            @Override
            public void onResponse(Call<ApiResponse> call, Response<ApiResponse> response) {
                btnMainAction.setEnabled(true);
                if (response.isSuccessful()) {
                    // Cập nhật trạng thái local
                    currentOrder.setOrderStatus(newStatus);
                    if ("delivering".equals(newStatus)) {
                        currentOrder.setPickedAt(new Date());
                    } else if ("delivered".equals(newStatus)) {
                        currentOrder.setDeliveredAt(new Date());
                    }
                    updateStatusUI();
                    
                    // Hiển thị popup thông báo
                    String msg = "delivering".equals(newStatus) ? "Bạn đã lấy thành công đơn hàng #" + currentOrder.getIdOrder() : 
                                 "Đơn hàng #" + currentOrder.getIdOrder() + " đã được giao thành công.";
                    com.example.shipper_app.utils.NotificationHelper.showTopPopup(OrderDetailActivity.this, 
                        "🔔 Thông báo mới", 
                        msg);

                    // Cập nhật lại UI thời gian
                    String actionTimeStr = TIME_FORMAT.format(new Date());
                    String actionPrefix = "delivering".equals(newStatus) ? "Lấy hàng lúc " : "Giao hàng lúc ";
                    
                    if ("delivered".equals(newStatus)) {
                        tvReceivedTime.setText(" " + actionPrefix + actionTimeStr);
                    } else {
                        String estTimeStr = "--:--";
                        if (currentOrder.getExpectedCompletionTime() != null) {
                            estTimeStr = TIME_FORMAT.format(currentOrder.getExpectedCompletionTime());
                        }
                        tvReceivedTime.setText(" " + actionPrefix + actionTimeStr + " · Dự kiến hoàn thành " + estTimeStr);
                    }
                } else {
                    Toast.makeText(OrderDetailActivity.this, "Lỗi cập nhật: " + response.code(), Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse> call, Throwable t) {
                btnMainAction.setEnabled(true);
                Toast.makeText(OrderDetailActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    /**
     * Dialog xác nhận giao hàng thành công
     */
    private void showConfirmDeliveredDialog() {
        new AlertDialog.Builder(this)
                .setTitle("Xác nhận giao hàng")
                .setMessage("Bạn đã giao hàng thành công cho khách hàng "
                        + currentOrder.getCustomerName() + "?")
                .setPositiveButton("Xác nhận", (dialog, which) -> {
                    updateStatusApi("delivered");
                })
                .setNegativeButton("Hủy", null)
                .show();
    }

    private void showReportProblemDialog() {
        String[] problems = {
                "Không liên hệ được khách hàng",
                "Địa chỉ giao hàng sai",
                "Khách hàng từ chối nhận hàng",
                "Sự cố giao thông",
                "Hàng hóa bị hỏng",
                "Khác..."
        };

        new AlertDialog.Builder(this)
                .setTitle("Báo cáo sự cố")
                .setItems(problems, (dialog, which) -> {
                    if (which == 0 || which == 2 || which == 5) {
                        Intent intent = new Intent(OrderDetailActivity.this, CreateIssueActivity.class);
                        intent.putExtra("ORDER_ID", currentOrder.getIdOrder());
                        intent.putExtra("ORDER_CODE", currentOrder.getOrderCode());
                        intent.putExtra("ORDER_OBJ", currentOrder);
                        if (which != 5) {
                            intent.putExtra("PRESET_REASON", problems[which]);
                        }
                        issueLauncher.launch(intent);
                    } else {
                        callComplaintApi(problems[which]);
                    }
                })
                .setNegativeButton("Hủy", null)
                .show();
    }

    private void showCustomProblemDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Nhập lý do sự cố");

        final android.widget.EditText input = new android.widget.EditText(this);
        input.setHint("Mô tả sự cố của bạn...");
        builder.setView(input);

        builder.setPositiveButton("Gửi", null);
        builder.setNegativeButton("Hủy", (dialog, which) -> dialog.cancel());

        AlertDialog dialog = builder.create();
        dialog.show();

        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String reason = input.getText().toString().trim();
            if (android.text.TextUtils.isEmpty(reason)) {
                input.setError("Vui lòng nhập lý do");
            } else {
                callComplaintApi(reason);
                dialog.dismiss();
            }
        });
    }

    private void callComplaintApi(String problem) {
        ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
        ApiService.ComplaintRequest request = new ApiService.ComplaintRequest(problem);

        apiService.reportComplaint(currentOrder.getIdOrder(), request).enqueue(new Callback<ApiResponse>() {
            @Override
            public void onResponse(Call<ApiResponse> call, Response<ApiResponse> response) {
                if (response.isSuccessful()) {
                    Toast.makeText(OrderDetailActivity.this, "Đã gửi báo cáo sự cố thành công", Toast.LENGTH_SHORT).show();
                    
                    String lower = problem.toLowerCase();
                    if (lower.contains("không liên hệ được") || 
                        lower.contains("từ chối nhận") || 
                        lower.contains("bom") || 
                        lower.contains("bùng")) {
                        finish();
                    }
                } else {
                    Toast.makeText(OrderDetailActivity.this, "Không thể gửi báo cáo", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse> call, Throwable t) {
                Toast.makeText(OrderDetailActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    public void onBackPressed() {
        super.onBackPressed();
        overridePendingTransition(android.R.anim.slide_in_left, android.R.anim.slide_out_right);
    }
}
