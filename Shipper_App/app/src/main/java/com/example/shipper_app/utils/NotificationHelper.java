package com.example.shipper_app.utils;

import android.app.Activity;
import android.app.Dialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.TextView;

import com.example.shipper_app.NotificationActivity;
import com.example.shipper_app.R;

public class NotificationHelper {

    public static void showTopPopup(Activity activity, String title, String body) {
        if (activity == null || activity.isFinishing()) return;

        final Dialog dialog = new Dialog(activity, android.R.style.Theme_Translucent_NoTitleBar);
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
        dialog.setContentView(R.layout.layout_top_popup);

        Window window = dialog.getWindow();
        if (window != null) {
            window.setGravity(Gravity.TOP);
            window.setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.WRAP_CONTENT);
            window.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            // Animation trượt xuống
            window.getAttributes().windowAnimations = android.R.style.Animation_Toast;
            window.clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND); // Không làm mờ background
            // Không nhận focus để không ảnh hưởng tương tác ở dưới nếu click ra ngoài
            window.setFlags(WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE);
        }

        TextView tvTitle = dialog.findViewById(R.id.tv_popup_title);
        TextView tvBody = dialog.findViewById(R.id.tv_popup_body);

        if (title != null) tvTitle.setText(title);
        if (body != null) tvBody.setText(body);

        // Chuyển hướng khi click
        View rootView = dialog.findViewById(android.R.id.content);
        if (rootView != null) {
            rootView.setOnClickListener(v -> {
                dialog.dismiss();
                activity.startActivity(new Intent(activity, NotificationActivity.class));
            });
        }

        dialog.show();

        // Tự động tắt sau 3 giây
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (dialog.isShowing() && !activity.isFinishing()) {
                dialog.dismiss();
            }
        }, 3000);
    }
}
