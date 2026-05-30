package com.example.shipper_app;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.example.shipper_app.api.ApiClient;
import com.example.shipper_app.api.ApiService;
import com.example.shipper_app.model.api.LoginResponse;
import com.example.shipper_app.model.api.RegisterRequest;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class RegisterActivity extends AppCompatActivity {

    private EditText editName;
    private EditText editPhone;
    private EditText editEmail;
    private EditText editPassword;
    private EditText editPasswordConfirm;
    private EditText editPlate;
    private Button btnRegister;
    private ImageButton btnBack;
    private ProgressBar progressBar;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_register);

        editName = findViewById(R.id.edit_name);
        editPhone = findViewById(R.id.edit_phone);
        editEmail = findViewById(R.id.edit_email);
        editPassword = findViewById(R.id.edit_password);
        editPasswordConfirm = findViewById(R.id.edit_password_confirm);
        editPlate = findViewById(R.id.edit_plate);
        btnRegister = findViewById(R.id.btn_register);
        btnBack = findViewById(R.id.btn_back);
        progressBar = findViewById(R.id.progress_bar);

        btnBack.setOnClickListener(v -> finish());

        btnRegister.setOnClickListener(v -> performRegister());
    }

    private void performRegister() {
        String name = editName.getText().toString().trim();
        String phone = editPhone.getText().toString().trim();
        String email = editEmail.getText().toString().trim();
        String password = editPassword.getText().toString().trim();
        String passwordConfirm = editPasswordConfirm.getText().toString().trim();
        String plate = editPlate.getText().toString().trim();

        if (TextUtils.isEmpty(name) || TextUtils.isEmpty(phone) || TextUtils.isEmpty(email) || TextUtils.isEmpty(password) || TextUtils.isEmpty(passwordConfirm)) {
            Toast.makeText(this, "Vui lòng nhập đủ các trường bắt buộc", Toast.LENGTH_SHORT).show();
            return;
        }

        if (!password.equals(passwordConfirm)) {
            Toast.makeText(this, "Mật khẩu xác nhận không khớp", Toast.LENGTH_SHORT).show();
            return;
        }

        if (phone.length() < 9 || phone.length() > 11) {
            Toast.makeText(this, "Số điện thoại không hợp lệ", Toast.LENGTH_SHORT).show();
            return;
        }

        if (password.length() < 6) {
            Toast.makeText(this, "Mật khẩu phải có ít nhất 6 ký tự", Toast.LENGTH_SHORT).show();
            return;
        }

        btnRegister.setVisibility(View.GONE);
        progressBar.setVisibility(View.VISIBLE);

        ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
        RegisterRequest request = new RegisterRequest(name, phone, email, password, plate);

        apiService.registerShipper(request).enqueue(new Callback<LoginResponse>() {
            @Override
            public void onResponse(Call<LoginResponse> call, Response<LoginResponse> response) {
                btnRegister.setVisibility(View.VISIBLE);
                progressBar.setVisibility(View.GONE);

                if (response.isSuccessful() && response.body() != null) {
                    Toast.makeText(RegisterActivity.this, "Đăng ký thành công! Vui lòng chờ admin phê duyệt.", Toast.LENGTH_LONG).show();
                    // Chuyển về màn hình đăng nhập hoặc tự động đăng nhập
                    Intent intent = new Intent(RegisterActivity.this, LoginActivity.class);
                    intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    startActivity(intent);
                    finish();
                } else {
                    Toast.makeText(RegisterActivity.this, "Đăng ký thất bại, số điện thoại có thể đã tồn tại", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<LoginResponse> call, Throwable t) {
                btnRegister.setVisibility(View.VISIBLE);
                progressBar.setVisibility(View.GONE);
                Toast.makeText(RegisterActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }
}
