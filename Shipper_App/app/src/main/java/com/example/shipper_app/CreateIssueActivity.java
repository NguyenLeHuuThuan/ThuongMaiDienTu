package com.example.shipper_app;

import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.example.shipper_app.api.ApiClient;
import com.example.shipper_app.api.ApiService;
import com.example.shipper_app.model.api.ApiResponse;

import android.content.Intent;
import android.net.Uri;
import android.provider.MediaStore;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CreateIssueActivity extends AppCompatActivity {
    
    private int orderId;
    private String orderCode;
    private com.example.shipper_app.model.Order orderObj;
    
    private java.util.List<Uri> selectedImageUris = new java.util.ArrayList<>();

    private final ActivityResultLauncher<Intent> galleryLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                    Intent data = result.getData();
                    if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        for (int i = 0; i < count; i++) {
                            if (selectedImageUris.size() < 5) {
                                selectedImageUris.add(data.getClipData().getItemAt(i).getUri());
                            } else {
                                Toast.makeText(this, "Chỉ được chọn tối đa 5 ảnh", Toast.LENGTH_SHORT).show();
                                break;
                            }
                        }
                    } else if (data.getData() != null) {
                        if (selectedImageUris.size() < 5) {
                            selectedImageUris.add(data.getData());
                        } else {
                            Toast.makeText(this, "Chỉ được chọn tối đa 5 ảnh", Toast.LENGTH_SHORT).show();
                        }
                    }
                    updateAttachmentUI();
                }
            }
    );

    private void updateAttachmentUI() {
        TextView tvAttachmentInfo = findViewById(R.id.tvAttachmentInfo);
        android.widget.LinearLayout layoutImages = findViewById(R.id.layoutImages);
        layoutImages.removeAllViews();
        
        if (selectedImageUris.isEmpty()) {
            tvAttachmentInfo.setText("Chưa có tệp nào được đính kèm");
            tvAttachmentInfo.setTextColor(android.graphics.Color.parseColor("#999999"));
            return;
        }
        
        tvAttachmentInfo.setText("Đã đính kèm " + selectedImageUris.size() + " ảnh");
        tvAttachmentInfo.setTextColor(android.graphics.Color.parseColor("#4CAF50"));
        
        for (int i = 0; i < selectedImageUris.size(); i++) {
            final int index = i;
            Uri uri = selectedImageUris.get(i);
            
            android.widget.FrameLayout frameLayout = new android.widget.FrameLayout(this);
            android.widget.LinearLayout.LayoutParams params = new android.widget.LinearLayout.LayoutParams(300, 300);
            params.setMargins(0, 0, 20, 0);
            frameLayout.setLayoutParams(params);
            
            android.widget.ImageView iv = new android.widget.ImageView(this);
            iv.setLayoutParams(new android.widget.FrameLayout.LayoutParams(
                android.view.ViewGroup.LayoutParams.MATCH_PARENT, 
                android.view.ViewGroup.LayoutParams.MATCH_PARENT
            ));
            iv.setScaleType(android.widget.ImageView.ScaleType.CENTER_CROP);
            iv.setImageURI(uri);
            
            ImageButton btnRemove = new ImageButton(this);
            android.widget.FrameLayout.LayoutParams btnParams = new android.widget.FrameLayout.LayoutParams(60, 60);
            btnParams.gravity = android.view.Gravity.TOP | android.view.Gravity.END;
            btnParams.setMargins(0, 8, 8, 0);
            btnRemove.setLayoutParams(btnParams);
            btnRemove.setBackgroundResource(android.R.drawable.ic_menu_close_clear_cancel);
            btnRemove.setOnClickListener(v -> {
                selectedImageUris.remove(index);
                updateAttachmentUI();
            });
            
            frameLayout.addView(iv);
            frameLayout.addView(btnRemove);
            layoutImages.addView(frameLayout);
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_create_issue);

        orderId = getIntent().getIntExtra("ORDER_ID", -1);
        orderCode = getIntent().getStringExtra("ORDER_CODE");
        orderObj = (com.example.shipper_app.model.Order) getIntent().getSerializableExtra("ORDER_OBJ");

        ImageButton btnBack = findViewById(R.id.btnBack);
        TextView tvOrderCode = findViewById(R.id.tvOrderCode);
        
        TextView tvRestaurantInfo = findViewById(R.id.tvRestaurantInfo);
        TextView tvCustomerInfo = findViewById(R.id.tvCustomerInfo);
        TextView tvPickupAddress = findViewById(R.id.tvPickupAddress);
        TextView tvDeliveryAddress = findViewById(R.id.tvDeliveryAddress);
        
        EditText etDescription = findViewById(R.id.etDescription);
        Button btnAttachImage = findViewById(R.id.btnAttachImage);
        Button btnAttachVideo = findViewById(R.id.btnAttachVideo);
        TextView tvAttachmentInfo = findViewById(R.id.tvAttachmentInfo);
        Button btnSubmit = findViewById(R.id.btnSubmit);

        btnBack.setOnClickListener(v -> finish());
        
        if (orderCode != null) {
            tvOrderCode.setText("Đơn hàng: #" + orderCode);
        }
        
        String presetReason = getIntent().getStringExtra("PRESET_REASON");
        if (presetReason != null) {
            etDescription.setText(presetReason);
        }
        
        if (orderObj != null) {
            tvRestaurantInfo.setText(android.text.Html.fromHtml("<b>Nhà hàng:</b> " + (orderObj.getRestaurantName() != null ? orderObj.getRestaurantName() : "")));
            tvCustomerInfo.setText(android.text.Html.fromHtml("<b>Khách hàng:</b> " + (orderObj.getCustomerName() != null ? orderObj.getCustomerName() : "") 
                + (orderObj.getCustomerPhone() != null ? " - " + orderObj.getCustomerPhone() : "")));
            tvPickupAddress.setText(android.text.Html.fromHtml("<b>Điểm lấy:</b> " + (orderObj.getPickupAddress() != null ? orderObj.getPickupAddress() : "")));
            tvDeliveryAddress.setText(android.text.Html.fromHtml("<b>Điểm giao:</b> " + (orderObj.getDeliveryAddress() != null ? orderObj.getDeliveryAddress() : "")));
        } else {
            tvRestaurantInfo.setVisibility(android.view.View.GONE);
            tvCustomerInfo.setVisibility(android.view.View.GONE);
            tvPickupAddress.setVisibility(android.view.View.GONE);
            tvDeliveryAddress.setVisibility(android.view.View.GONE);
        }

        btnAttachImage.setOnClickListener(v -> {
            Intent intent = new Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI);
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            galleryLauncher.launch(intent);
        });

        btnAttachVideo.setOnClickListener(v -> {
            Toast.makeText(this, "Chức năng đính kèm video sẽ được cập nhật sau", Toast.LENGTH_SHORT).show();
        });

        btnSubmit.setOnClickListener(v -> {
            String desc = etDescription.getText().toString().trim();
            if (desc.isEmpty()) {
                Toast.makeText(this, "Vui lòng nhập mô tả sự cố", Toast.LENGTH_SHORT).show();
                return;
            }

            String lowerDesc = desc.toLowerCase();
            boolean isBoom = lowerDesc.contains("không liên hệ") || 
                             lowerDesc.contains("từ chối nhận") || 
                             lowerDesc.contains("bom") || 
                             lowerDesc.contains("bùng");
            if (isBoom && selectedImageUris.size() < 2) {
                Toast.makeText(this, "Vui lòng đính kèm ít nhất 2 ảnh minh chứng (ảnh đơn hàng còn nguyên và ảnh 3 cuộc gọi nhỡ)!", Toast.LENGTH_LONG).show();
                return;
            }

            btnSubmit.setEnabled(false);
            btnSubmit.setText("ĐANG GỬI...");

            ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
            Call<ApiResponse> call;
            
            if (!selectedImageUris.isEmpty()) {
                try {
                    java.util.List<okhttp3.MultipartBody.Part> parts = new java.util.ArrayList<>();
                    for (int i = 0; i < selectedImageUris.size(); i++) {
                        Uri uri = selectedImageUris.get(i);
                        java.io.InputStream inputStream = getContentResolver().openInputStream(uri);
                        java.io.ByteArrayOutputStream byteBuffer = new java.io.ByteArrayOutputStream();
                        byte[] buffer = new byte[1024];
                        int len;
                        while ((len = inputStream.read(buffer)) != -1) {
                            byteBuffer.write(buffer, 0, len);
                        }
                        byte[] bytes = byteBuffer.toByteArray();
                        inputStream.close();
                        
                        String mimeType = getContentResolver().getType(uri);
                        if (mimeType == null) mimeType = "image/jpeg";
                        
                        okhttp3.RequestBody requestFile = okhttp3.RequestBody.create(okhttp3.MediaType.parse(mimeType), bytes);
                        parts.add(okhttp3.MultipartBody.Part.createFormData("issue_images", "issue" + i + ".jpg", requestFile));
                    }
                    okhttp3.RequestBody descBody = okhttp3.RequestBody.create(okhttp3.MultipartBody.FORM, desc);
                    
                    call = apiService.reportComplaintWithImages(orderId, descBody, parts);
                } catch (Exception e) {
                    btnSubmit.setEnabled(true);
                    btnSubmit.setText("GỬI BÁO CÁO");
                    Toast.makeText(this, "Lỗi khi đọc file ảnh", Toast.LENGTH_SHORT).show();
                    return;
                }
            } else {
                ApiService.ComplaintRequest req = new ApiService.ComplaintRequest(desc);
                call = apiService.reportComplaint(orderId, req);
            }
            
            call.enqueue(new Callback<ApiResponse>() {
                @Override
                public void onResponse(Call<ApiResponse> call, Response<ApiResponse> response) {
                    btnSubmit.setEnabled(true);
                    btnSubmit.setText("GỬI BÁO CÁO");
                    if (response.isSuccessful()) {
                        Toast.makeText(CreateIssueActivity.this, "Đã gửi báo cáo thành công", Toast.LENGTH_SHORT).show();
                        setResult(RESULT_OK);
                        finish();
                    } else {
                        Toast.makeText(CreateIssueActivity.this, "Lỗi khi gửi báo cáo", Toast.LENGTH_SHORT).show();
                    }
                }

                @Override
                public void onFailure(Call<ApiResponse> call, Throwable t) {
                    btnSubmit.setEnabled(true);
                    btnSubmit.setText("GỬI BÁO CÁO");
                    Toast.makeText(CreateIssueActivity.this, "Lỗi kết nối", Toast.LENGTH_SHORT).show();
                }
            });
        });
    }
}
