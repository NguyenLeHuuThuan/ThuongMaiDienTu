package com.example.shipper_app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;

import androidx.appcompat.app.AppCompatActivity;

/**
 * MainActivity - Điểm khởi đầu của ứng dụng
 * Kiểm tra xem đã đăng nhập chưa, nếu rồi thì vào Home, chưa thì vào Login
 */
public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Kiểm tra xem đã đăng nhập chưa
        SharedPreferences prefs = getSharedPreferences("ShipperAppPrefs", Context.MODE_PRIVATE);
        String token = prefs.getString("token", null);

        Intent intent;
        if (token != null && !token.isEmpty()) {
            // Đã có token (tài khoản đăng nhập gần nhất), chuyển thẳng vào HomeActivity
            intent = new Intent(this, HomeActivity.class);
        } else {
            // Chưa đăng nhập, chuyển sang LoginActivity
            intent = new Intent(this, LoginActivity.class);
        }

        startActivity(intent);
        finish(); // Đóng MainActivity để không quay lại được bằng nút Back
    }
}