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

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CreateIssueActivity extends AppCompatActivity {
    
    private int orderId;
    private String orderCode;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_create_issue);

        orderId = getIntent().getIntExtra("ORDER_ID", -1);
        orderCode = getIntent().getStringExtra("ORDER_CODE");

        ImageButton btnBack = findViewById(R.id.btnBack);
        TextView tvOrderCode = findViewById(R.id.tvOrderCode);
        EditText etDescription = findViewById(R.id.etDescription);
        Button btnAttachImage = findViewById(R.id.btnAttachImage);
        Button btnAttachVideo = findViewById(R.id.btnAttachVideo);
        TextView tvAttachmentInfo = findViewById(R.id.tvAttachmentInfo);
        Button btnSubmit = findViewById(R.id.btnSubmit);

        btnBack.setOnClickListener(v -> finish());
        
        if (orderCode != null) {
            tvOrderCode.setText("Đơn hàng: #" + orderCode);
        }

        btnAttachImage.setOnClickListener(v -> {
            Toast.makeText(this, "Chức năng đính kèm ảnh sẽ được cập nhật sau", Toast.LENGTH_SHORT).show();
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

            btnSubmit.setEnabled(false);
            btnSubmit.setText("ĐANG GỬI...");

            ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
            ApiService.ComplaintRequest req = new ApiService.ComplaintRequest(desc);
            
            apiService.reportComplaint(orderId, req).enqueue(new Callback<ApiResponse>() {
                @Override
                public void onResponse(Call<ApiResponse> call, Response<ApiResponse> response) {
                    btnSubmit.setEnabled(true);
                    btnSubmit.setText("GỬI BÁO CÁO");
                    if (response.isSuccessful()) {
                        Toast.makeText(CreateIssueActivity.this, "Đã gửi báo cáo thành công", Toast.LENGTH_SHORT).show();
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
