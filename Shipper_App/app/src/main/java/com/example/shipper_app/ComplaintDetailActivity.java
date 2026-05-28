package com.example.shipper_app;

import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.example.shipper_app.api.ApiClient;
import com.example.shipper_app.model.Complaint;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import com.example.shipper_app.api.ApiService;
import com.example.shipper_app.model.Order;
import android.widget.Toast;

public class ComplaintDetailActivity extends AppCompatActivity {

    public static final String EXTRA_COMPLAINT = "extra_complaint";
    private Complaint complaint;

    private ImageButton btnBack;
    private TextView tvOrderId, tvRestaurant, tvStatus, tvDate, tvDescription;
    private TextView tvMediaLabel, tvImageLink, tvVideoLink, tvResolution;
    private LinearLayout layoutResolution;
    private TextView btnViewOrder;
    private android.widget.Button btnWithdrawComplaint;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_complaint_detail);

        complaint = (Complaint) getIntent().getSerializableExtra(EXTRA_COMPLAINT);
        if (complaint == null) {
            finish();
            return;
        }

        initViews();
        populateData();

        btnBack.setOnClickListener(v -> finish());
    }

    private void initViews() {
        btnBack = findViewById(R.id.btnBack);
        tvOrderId = findViewById(R.id.tvOrderId);
        tvRestaurant = findViewById(R.id.tvRestaurant);
        tvStatus = findViewById(R.id.tvStatus);
        tvDate = findViewById(R.id.tvDate);
        tvDescription = findViewById(R.id.tvDescription);
        tvMediaLabel = findViewById(R.id.tvMediaLabel);
        tvImageLink = findViewById(R.id.tvImageLink);
        tvVideoLink = findViewById(R.id.tvVideoLink);
        layoutResolution = findViewById(R.id.layoutResolution);
        tvResolution = findViewById(R.id.tvResolution);
        btnViewOrder = findViewById(R.id.btnViewOrder);
        btnWithdrawComplaint = findViewById(R.id.btnWithdrawComplaint);
    }

    private void populateData() {
        tvOrderId.setText("Đơn hàng #" + complaint.getIdOrder());
        tvRestaurant.setText("Từ: " + (complaint.getNameRestaurant() != null ? complaint.getNameRestaurant() : "Không rõ"));

        // Format Date
        String displayDate = complaint.getCreatedAt();
        try {
            SimpleDateFormat inputFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault());
            SimpleDateFormat outputFormat = new SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault());
            Date date = inputFormat.parse(complaint.getCreatedAt());
            if (date != null) {
                displayDate = outputFormat.format(date);
            }
        } catch (ParseException e) {
            e.printStackTrace();
        }
        tvDate.setText("Thời gian: " + displayDate);

        tvDescription.setText(complaint.getDescription());

        // Status
        String statusText = "Chờ xử lý";
        int statusColor = Color.parseColor("#F57C00");
        if ("resolved".equalsIgnoreCase(complaint.getStatus())) {
            statusText = "Đã xử lý";
            statusColor = Color.parseColor("#FF6600");
            layoutResolution.setVisibility(View.VISIBLE);
            tvResolution.setText(complaint.getResolution() != null ? complaint.getResolution() : "Không có thông tin");
        } else {
            layoutResolution.setVisibility(View.GONE);
        }
        tvStatus.setText(statusText);
        GradientDrawable bgShape = (GradientDrawable) tvStatus.getBackground();
        if (bgShape != null) bgShape.setColor(statusColor);

        // Media (Image / Video)
        boolean hasMedia = false;
        if (complaint.getImage() != null && !complaint.getImage().isEmpty()) {
            hasMedia = true;
            android.widget.LinearLayout layoutAttachedImages = findViewById(R.id.layoutAttachedImages);
            layoutAttachedImages.removeAllViews();
            
            String[] imageUrls = complaint.getImage().split(",");
            for (String img : imageUrls) {
                String imageUrl = img.trim();
                if (!imageUrl.startsWith("http")) {
                    imageUrl = ApiClient.BASE_URL + (imageUrl.startsWith("/") ? imageUrl.substring(1) : imageUrl);
                }
                final String finalImageUrl = imageUrl;
                
                android.widget.ImageView iv = new android.widget.ImageView(this);
                android.widget.LinearLayout.LayoutParams params = new android.widget.LinearLayout.LayoutParams(
                        (int) (120 * getResources().getDisplayMetrics().density), 
                        (int) (120 * getResources().getDisplayMetrics().density)
                );
                params.setMargins(0, 0, 16, 0);
                iv.setLayoutParams(params);
                iv.setScaleType(android.widget.ImageView.ScaleType.CENTER_CROP);
                iv.setBackgroundColor(android.graphics.Color.parseColor("#E0E0E0"));
                
                layoutAttachedImages.addView(iv);
                
                // Tải ảnh trực tiếp lên ImageView
                new Thread(() -> {
                    try {
                        java.io.InputStream in = new java.net.URL(finalImageUrl).openStream();
                        android.graphics.Bitmap bmp = android.graphics.BitmapFactory.decodeStream(in);
                        in.close();
                        runOnUiThread(() -> {
                            if (bmp != null) {
                                iv.setImageBitmap(bmp);
                            }
                        });
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }).start();
                
                iv.setOnClickListener(v -> {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(finalImageUrl));
                    startActivity(intent);
                });
            }
        }

        if (complaint.getVideo() != null && !complaint.getVideo().isEmpty()) {
            hasMedia = true;
            tvVideoLink.setVisibility(View.VISIBLE);
            String videoUrl = complaint.getVideo();
            if (!videoUrl.startsWith("http")) {
                videoUrl = ApiClient.BASE_URL + videoUrl;
            }
            final String finalVideoUrlStr = videoUrl;
            tvVideoLink.setOnClickListener(v -> {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(finalVideoUrlStr));
                startActivity(intent);
            });
        }

        if (hasMedia) {
            tvMediaLabel.setVisibility(View.VISIBLE);
        } else {
            tvMediaLabel.setVisibility(View.VISIBLE);
            tvMediaLabel.setText("Hình ảnh / Video đính kèm: Không có");
            tvMediaLabel.setTextColor(Color.GRAY);
        }

        btnViewOrder.setOnClickListener(v -> {
            btnViewOrder.setEnabled(false);
            btnViewOrder.setText("Đang tải...");
            ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
            apiService.getOrderById(complaint.getIdOrder()).enqueue(new Callback<Order>() {
                @Override
                public void onResponse(Call<Order> call, Response<Order> response) {
                    btnViewOrder.setEnabled(true);
                    btnViewOrder.setText("Xem đơn");
                    if (response.isSuccessful() && response.body() != null) {
                        Intent intent = new Intent(ComplaintDetailActivity.this, OrderDetailActivity.class);
                        intent.putExtra(HomeActivity.EXTRA_ORDER, response.body());
                        intent.putExtra("EXTRA_READ_ONLY", true);
                        startActivity(intent);
                    } else {
                        Toast.makeText(ComplaintDetailActivity.this, "Không thể tải chi tiết đơn hàng", Toast.LENGTH_SHORT).show();
                    }
                }

                @Override
                public void onFailure(Call<Order> call, Throwable t) {
                    btnViewOrder.setEnabled(true);
                    btnViewOrder.setText("Xem đơn");
                    Toast.makeText(ComplaintDetailActivity.this, "Lỗi kết nối", Toast.LENGTH_SHORT).show();
                }
            });
        });

        // Gỡ khiếu nại (Withdraw Complaint)
        if ("pending".equalsIgnoreCase(complaint.getStatus()) || "processing".equalsIgnoreCase(complaint.getStatus())) {
            btnWithdrawComplaint.setVisibility(View.VISIBLE);
            btnWithdrawComplaint.setOnClickListener(v -> showWithdrawDialog());
        } else {
            btnWithdrawComplaint.setVisibility(View.GONE);
        }
    }

    private void showWithdrawDialog() {
        android.widget.EditText etReason = new android.widget.EditText(this);
        etReason.setHint("Nhập lý do gỡ khiếu nại...");
        
        // Add some padding to EditText in dialog
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(50, 20, 50, 0);
        layout.addView(etReason);

        new androidx.appcompat.app.AlertDialog.Builder(this)
                .setTitle("Gỡ Khiếu Nại")
                .setMessage("Vui lòng nhập lý do để gỡ khiếu nại này:")
                .setView(layout)
                .setPositiveButton("Gửi", (dialog, which) -> {
                    String reason = etReason.getText().toString().trim();
                    if (reason.isEmpty()) {
                        Toast.makeText(this, "Vui lòng nhập lý do!", Toast.LENGTH_SHORT).show();
                        return;
                    }
                    submitWithdrawal(reason);
                })
                .setNegativeButton("Hủy", null)
                .show();
    }

    private void submitWithdrawal(String reason) {
        btnWithdrawComplaint.setEnabled(false);
        btnWithdrawComplaint.setText("ĐANG GỬI...");
        
        ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
        ApiService.WithdrawRequest request = new ApiService.WithdrawRequest(reason);
        
        apiService.withdrawComplaint(complaint.getIdComplaint(), request).enqueue(new Callback<com.example.shipper_app.model.api.ApiResponse>() {
            @Override
            public void onResponse(Call<com.example.shipper_app.model.api.ApiResponse> call, Response<com.example.shipper_app.model.api.ApiResponse> response) {
                if (response.isSuccessful()) {
                    Toast.makeText(ComplaintDetailActivity.this, "Đã gỡ khiếu nại thành công", Toast.LENGTH_SHORT).show();
                    finish(); // Quay lại trang trước
                } else {
                    btnWithdrawComplaint.setEnabled(true);
                    btnWithdrawComplaint.setText("GỠ KHIẾU NẠI");
                    Toast.makeText(ComplaintDetailActivity.this, "Lỗi khi gỡ khiếu nại", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<com.example.shipper_app.model.api.ApiResponse> call, Throwable t) {
                btnWithdrawComplaint.setEnabled(true);
                btnWithdrawComplaint.setText("GỠ KHIẾU NẠI");
                Toast.makeText(ComplaintDetailActivity.this, "Lỗi kết nối", Toast.LENGTH_SHORT).show();
            }
        });
    }
}
