package com.example.shipper_app;

import android.content.Intent;
import android.os.Bundle;

import androidx.appcompat.app.AppCompatActivity;

/**
 * MainActivity - Điểm khởi đầu của ứng dụng
 * Chuyển hướng ngay sang HomeActivity (màn hình chính cho shipper)
 * Sau này có thể thêm màn hình Login trước khi vào Home
 */
public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Chuyển sang LoginActivity
        Intent intent = new Intent(this, LoginActivity.class);
        startActivity(intent);
        finish(); // Đóng MainActivity để không quay lại được bằng nút Back
    }
}