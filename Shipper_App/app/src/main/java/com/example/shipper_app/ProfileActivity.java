package com.example.shipper_app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import android.content.Intent;
import android.net.Uri;
import android.provider.MediaStore;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.cardview.widget.CardView;

import com.example.shipper_app.api.ApiClient;
import com.example.shipper_app.api.ApiService;
import com.example.shipper_app.model.api.ApiResponse;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ProfileActivity extends AppCompatActivity {

    private ImageButton btnBack;
    private ImageView ivAvatar;
    private TextView tvRating;
    private EditText etFullName, etPhone, etEmail, etLicensePlate;
    private Button btnSave;
    private ProgressBar progressBar;
    private CardView cvEditAvatar;

    private Uri selectedImageUri;

    private ApiService apiService;

    private final ActivityResultLauncher<Intent> galleryLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                    selectedImageUri = result.getData().getData();
                    if (selectedImageUri != null) {
                        ivAvatar.setImageURI(selectedImageUri);
                    }
                }
            }
    );

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_profile);

        apiService = ApiClient.getClient(this).create(ApiService.class);

        initViews();
        loadProfileData();

        btnBack.setOnClickListener(v -> finish());
        btnSave.setOnClickListener(v -> saveProfileData());
        cvEditAvatar.setOnClickListener(v -> openGallery());
    }

    private void openGallery() {
        Intent intent = new Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI);
        galleryLauncher.launch(intent);
    }

    private void initViews() {
        btnBack = findViewById(R.id.btnBack);
        ivAvatar = findViewById(R.id.ivAvatar);
        tvRating = findViewById(R.id.tvRating);
        etFullName = findViewById(R.id.etFullName);
        etPhone = findViewById(R.id.etPhone);
        etEmail = findViewById(R.id.etEmail);
        etLicensePlate = findViewById(R.id.etLicensePlate);
        btnSave = findViewById(R.id.btnSave);
        progressBar = findViewById(R.id.progressBar);
        cvEditAvatar = findViewById(R.id.cvEditAvatar);
    }

    private void loadProfileData() {
        progressBar.setVisibility(View.VISIBLE);
        apiService.getProfile().enqueue(new Callback<ApiService.ProfileResponse>() {
            @Override
            public void onResponse(Call<ApiService.ProfileResponse> call, Response<ApiService.ProfileResponse> response) {
                progressBar.setVisibility(View.GONE);
                if (response.isSuccessful() && response.body() != null) {
                    ApiService.ProfileResponse profile = response.body();
                    etFullName.setText(profile.fullName != null ? profile.fullName : "");
                    etPhone.setText(profile.phone != null ? profile.phone : "");
                    etEmail.setText(profile.email != null ? profile.email : "");
                    etLicensePlate.setText(profile.license_plate != null ? profile.license_plate : "");
                    tvRating.setText(String.format("⭐ %.1f", profile.rating_Avg));
                    
                    if (profile.avatar != null && !profile.avatar.isEmpty()) {
                        String avatarUrl = ApiClient.BASE_URL + (profile.avatar.startsWith("/") ? profile.avatar.substring(1) : profile.avatar);
                        getSharedPreferences("ShipperAppPrefs", Context.MODE_PRIVATE)
                            .edit().putString("driverAvatar", avatarUrl).apply();
                        new Thread(() -> {
                            try {
                                java.io.InputStream in = new java.net.URL(avatarUrl).openStream();
                                android.graphics.Bitmap bmp = android.graphics.BitmapFactory.decodeStream(in);
                                runOnUiThread(() -> {
                                    if (bmp != null) ivAvatar.setImageBitmap(bmp);
                                });
                            } catch (Exception e) {
                                e.printStackTrace();
                            }
                        }).start();
                    }
                } else {
                    Toast.makeText(ProfileActivity.this, "Không thể tải thông tin cá nhân", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiService.ProfileResponse> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                Toast.makeText(ProfileActivity.this, "Lỗi kết nối", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void saveProfileData() {
        String fullName = etFullName.getText().toString().trim();
        String phone = etPhone.getText().toString().trim();
        String email = etEmail.getText().toString().trim();
        String licensePlate = etLicensePlate.getText().toString().trim();

        if (fullName.isEmpty() || phone.isEmpty()) {
            Toast.makeText(this, "Họ tên và Số điện thoại không được để trống", Toast.LENGTH_SHORT).show();
            return;
        }

        btnSave.setEnabled(false);
        btnSave.setText("ĐANG LƯU...");
        progressBar.setVisibility(View.VISIBLE);

        Call<ApiResponse> call;
        
        if (selectedImageUri != null) {
            try {
                java.io.InputStream inputStream = getContentResolver().openInputStream(selectedImageUri);
                java.io.ByteArrayOutputStream byteBuffer = new java.io.ByteArrayOutputStream();
                byte[] buffer = new byte[1024];
                int len;
                while ((len = inputStream.read(buffer)) != -1) {
                    byteBuffer.write(buffer, 0, len);
                }
                byte[] bytes = byteBuffer.toByteArray();
                inputStream.close();
                
                String mimeType = getContentResolver().getType(selectedImageUri);
                if (mimeType == null) mimeType = "image/jpeg";
                
                okhttp3.RequestBody requestFile = okhttp3.RequestBody.create(okhttp3.MediaType.parse(mimeType), bytes);
                okhttp3.MultipartBody.Part avatarPart = okhttp3.MultipartBody.Part.createFormData("avatar", "avatar.jpg", requestFile);
                
                okhttp3.RequestBody fnBody = okhttp3.RequestBody.create(okhttp3.MultipartBody.FORM, fullName);
                okhttp3.RequestBody emBody = okhttp3.RequestBody.create(okhttp3.MultipartBody.FORM, email);
                okhttp3.RequestBody phBody = okhttp3.RequestBody.create(okhttp3.MultipartBody.FORM, phone);
                okhttp3.RequestBody lpBody = okhttp3.RequestBody.create(okhttp3.MultipartBody.FORM, licensePlate);
                
                call = apiService.updateProfileWithAvatar(fnBody, emBody, phBody, lpBody, avatarPart);
            } catch (Exception e) {
                btnSave.setEnabled(true);
                btnSave.setText("LƯU THAY ĐỔI");
                progressBar.setVisibility(View.GONE);
                Toast.makeText(this, "Lỗi khi đọc file ảnh", Toast.LENGTH_SHORT).show();
                return;
            }
        } else {
            ApiService.ProfileRequest request = new ApiService.ProfileRequest(fullName, email, phone, licensePlate);
            call = apiService.updateProfile(request);
        }

        call.enqueue(new Callback<ApiResponse>() {
            @Override
            public void onResponse(Call<ApiResponse> call, Response<ApiResponse> response) {
                progressBar.setVisibility(View.GONE);
                btnSave.setEnabled(true);
                btnSave.setText("LƯU THAY ĐỔI");
                if (response.isSuccessful()) {
                    Toast.makeText(ProfileActivity.this, "Cập nhật thành công", Toast.LENGTH_SHORT).show();
                    // Update SharedPreferences name so the header gets updated next time it loads
                    SharedPreferences prefs = getSharedPreferences("ShipperAppPrefs", Context.MODE_PRIVATE);
                    prefs.edit().putString("driverName", fullName).apply();
                } else {
                    Toast.makeText(ProfileActivity.this, "Lỗi cập nhật", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                btnSave.setEnabled(true);
                btnSave.setText("LƯU THAY ĐỔI");
                Toast.makeText(ProfileActivity.this, "Lỗi kết nối", Toast.LENGTH_SHORT).show();
            }
        });
    }
}
