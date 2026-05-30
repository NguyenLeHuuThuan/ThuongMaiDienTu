package com.example.shipper_app;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.appcompat.app.AppCompatActivity;

import com.example.shipper_app.api.ApiClient;
import com.example.shipper_app.api.ApiService;
import com.example.shipper_app.model.api.LoginRequest;
import com.example.shipper_app.model.api.LoginResponse;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * LoginActivity - Màn hình đăng nhập dành cho Shipper
 * Kiểm tra tài khoản dựa trên cơ sở dữ liệu MonNgonTaiNha.sql
 */
public class LoginActivity extends AppCompatActivity {

    private EditText editPhone;
    private EditText editPassword;
    private Button btnLogin;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);

        // Khởi tạo các view
        editPhone = findViewById(R.id.edit_phone);
        editPassword = findViewById(R.id.edit_password);
        btnLogin = findViewById(R.id.btn_login);

        // Thiết lập sự kiện click cho nút đăng nhập
        btnLogin.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                performLogin();
            }
        });

        // Thiết lập sự kiện click cho nút đăng ký
        TextView textRegister = findViewById(R.id.text_register);
        textRegister.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(LoginActivity.this, RegisterActivity.class);
                startActivity(intent);
            }
        });
    }

    private void performLogin() {
        String phone = editPhone.getText().toString().trim();
        String password = editPassword.getText().toString().trim();

        // 1. Kiểm tra rỗng
        if (TextUtils.isEmpty(phone) || TextUtils.isEmpty(password)) {
            Toast.makeText(this, getString(R.string.error_empty_fields), Toast.LENGTH_SHORT).show();
            return;
        }

        // 2. Gọi API đăng nhập
        ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
        LoginRequest request = new LoginRequest(phone, password);

        btnLogin.setEnabled(false);
        btnLogin.setText("Đang đăng nhập...");

        apiService.login(request).enqueue(new Callback<LoginResponse>() {
            @Override
            public void onResponse(Call<LoginResponse> call, Response<LoginResponse> response) {
                btnLogin.setEnabled(true);
                btnLogin.setText("Đăng nhập");

                if (response.isSuccessful() && response.body() != null) {
                    LoginResponse loginResponse = response.body();

                    // Kiểm tra xem có phải driver không
                    if (loginResponse.getUser() != null && "driver".equals(loginResponse.getUser().getRole())) {
                        
                        // Lưu token vào SharedPreferences
                        SharedPreferences prefs = getSharedPreferences("ShipperAppPrefs", Context.MODE_PRIVATE);
                        SharedPreferences.Editor editor = prefs.edit();
                        editor.putString("token", loginResponse.getToken());
                        editor.putString("driverName", loginResponse.getUser().getFullName());
                        editor.apply();

                        // Chuyển hướng sang HomeActivity
                        Intent intent = new Intent(LoginActivity.this, HomeActivity.class);
                        startActivity(intent);
                        finish();
                    } else {
                        Toast.makeText(LoginActivity.this, "Tài khoản không có quyền truy cập ứng dụng Shipper.", Toast.LENGTH_SHORT).show();
                    }
                } else {
                    try {
                        String errorBody = response.errorBody().string();
                        org.json.JSONObject jsonObject = new org.json.JSONObject(errorBody);
                        String message = jsonObject.getString("message");
                        Toast.makeText(LoginActivity.this, message, Toast.LENGTH_LONG).show();
                    } catch (Exception e) {
                        Toast.makeText(LoginActivity.this, "Lỗi: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                    }
                }
            }

            @Override
            public void onFailure(Call<LoginResponse> call, Throwable t) {
                btnLogin.setEnabled(true);
                btnLogin.setText("Đăng nhập");
                Toast.makeText(LoginActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }
}
