package com.example.shipper_app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.EditText;
import android.text.InputType;
import androidx.appcompat.app.AlertDialog;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.view.GravityCompat;
import androidx.drawerlayout.widget.DrawerLayout;

import com.example.shipper_app.api.ApiClient;
import com.example.shipper_app.api.ApiService;
import com.google.android.material.navigation.NavigationView;

import java.text.DecimalFormat;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class StatisticsActivity extends AppCompatActivity {

    private DrawerLayout drawerLayout;
    private ImageButton btnMenu;
    private NavigationView navView;

    private TextView tvTotalEarnings, tvTargetProgress, tvCompletedOrders, tvCancelledOrders, tvActiveHours, tvRatingAvg, tvTargetLabel;
    private ImageView ivVisibility;
    private ProgressBar progressTarget;
    private LinearLayout llOrderHistory;
    
    private TextView tabToday, tabWeek, tabMonth;
    private String currentFilter = "week"; // Default
    private boolean isEarningsVisible = true;
    private ApiService.StatisticsResponse currentStats;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_statistics);

        initViews();
        setupTabs();
        fetchStatistics();
    }

    private void initViews() {
        drawerLayout = findViewById(R.id.drawer_layout);
        btnMenu = findViewById(R.id.btn_menu);
        navView = findViewById(R.id.nav_view);

        // Bắt sự kiện bấm nút Menu để mở Sidebar
        btnMenu.setOnClickListener(v -> {
            if (drawerLayout != null) {
                drawerLayout.openDrawer(GravityCompat.START);
            }
        });

        tvTotalEarnings = findViewById(R.id.tv_total_earnings);
        tvTargetProgress = findViewById(R.id.tv_target_progress);
        progressTarget = findViewById(R.id.progress_target);
        tvCompletedOrders = findViewById(R.id.tv_completed_orders);
        tvCancelledOrders = findViewById(R.id.tv_cancelled_orders);
        tvActiveHours = findViewById(R.id.tv_active_hours);
        tvRatingAvg = findViewById(R.id.tv_rating_avg);
        llOrderHistory = findViewById(R.id.ll_order_history);
        tvTargetLabel = findViewById(R.id.tv_target_label);
        ivVisibility = findViewById(R.id.iv_visibility);
        
        tabToday = findViewById(R.id.tab_today);
        tabWeek = findViewById(R.id.tab_week);
        tabMonth = findViewById(R.id.tab_month);

        ivVisibility.setOnClickListener(v -> {
            isEarningsVisible = !isEarningsVisible;
            if (isEarningsVisible) {
                ivVisibility.setImageResource(R.drawable.ic_visibility);
            } else {
                ivVisibility.setImageResource(R.drawable.ic_visibility_off);
            }
            if (currentStats != null) {
                updateUI(currentStats);
            }
        });

        View.OnClickListener targetClickListener = v -> showTargetDialog();
        tvTargetLabel.setOnClickListener(targetClickListener);
        progressTarget.setOnClickListener(targetClickListener);

        if (navView != null) {
            View headerView = navView.getHeaderView(0);
            TextView tvDriverName = headerView.findViewById(R.id.tv_driver_name);
            
            SharedPreferences prefs = getSharedPreferences("ShipperAppPrefs", Context.MODE_PRIVATE);
            String driverName = prefs.getString("driverName", "Tài xế");
            if (tvDriverName != null) {
                tvDriverName.setText(driverName);
            }

            navView.setCheckedItem(R.id.nav_statistics);

            navView.setNavigationItemSelectedListener(item -> {
                int id = item.getItemId();
                if (id == R.id.nav_home) {
                    finish();
                } else if (id == R.id.nav_orders) {
                    Intent intent = new Intent(StatisticsActivity.this, AcceptedOrdersActivity.class);
                    startActivity(intent);
                    finish();
                } else if (id == R.id.nav_issues) {
                    Intent intent = new Intent(StatisticsActivity.this, IssueActivity.class);
                    startActivity(intent);
                    finish();
                } else if (id == R.id.nav_logout) {
                    SharedPreferences prefsLogout = getSharedPreferences("ShipperAppPrefs", Context.MODE_PRIVATE);
                    prefsLogout.edit().clear().apply();
                    
                    Intent intent = new Intent(StatisticsActivity.this, LoginActivity.class);
                    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                    startActivity(intent);
                    finish();
                }
                
                drawerLayout.closeDrawer(GravityCompat.START);
                return true;
            });
        }
    }

    private void setupTabs() {
        tabToday.setOnClickListener(v -> updateTabSelection("today"));
        tabWeek.setOnClickListener(v -> updateTabSelection("week"));
        tabMonth.setOnClickListener(v -> updateTabSelection("month"));
    }

    private void updateTabSelection(String filter) {
        currentFilter = filter;
        
        // Reset all tabs
        tabToday.setBackground(null);
        tabToday.setTextColor(0xFF757575);
        tabToday.setTypeface(null, Typeface.NORMAL);
        
        tabWeek.setBackground(null);
        tabWeek.setTextColor(0xFF757575);
        tabWeek.setTypeface(null, Typeface.NORMAL);
        
        tabMonth.setBackground(null);
        tabMonth.setTextColor(0xFF757575);
        tabMonth.setTypeface(null, Typeface.NORMAL);
        
        // Highlight selected tab
        TextView selectedTab;
        if (filter.equals("today")) selectedTab = tabToday;
        else if (filter.equals("month")) selectedTab = tabMonth;
        else selectedTab = tabWeek;

        selectedTab.setBackgroundResource(R.drawable.bg_white_rounded);
        selectedTab.setTextColor(0xFF1A1A1A);
        selectedTab.setTypeface(null, Typeface.BOLD);
        
        // Update earnings label
        TextView tvTitle = findViewById(R.id.tv_earnings_title);
        if (tvTitle != null) {
            if (filter.equals("today")) {
                tvTitle.setText("Tổng thu nhập hôm nay");
            } else if (filter.equals("month")) {
                tvTitle.setText("Tổng thu nhập tháng này");
            } else {
                tvTitle.setText("Tổng thu nhập tuần này");
            }
        }
        
        if (currentStats != null) {
            updateUI(currentStats); // Update immediately with current target, then fetch new
        }
        fetchStatistics();
    }
    
    private double getTargetEarnings() {
        SharedPreferences prefs = getSharedPreferences("ShipperAppPrefs", Context.MODE_PRIVATE);
        if (currentFilter.equals("today")) return prefs.getFloat("target_today", 1000000f);
        if (currentFilter.equals("month")) return prefs.getFloat("target_month", 20000000f);
        return prefs.getFloat("target_week", 5000000f);
    }
    
    private void showTargetDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Điều chỉnh mục tiêu");
        
        final EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_NUMBER);
        input.setText(String.valueOf((int) getTargetEarnings()));
        builder.setView(input);
        
        builder.setPositiveButton("Lưu", (dialog, which) -> {
            try {
                double newTarget = Double.parseDouble(input.getText().toString());
                if (newTarget > 0) {
                    SharedPreferences prefs = getSharedPreferences("ShipperAppPrefs", Context.MODE_PRIVATE);
                    SharedPreferences.Editor editor = prefs.edit();
                    if (currentFilter.equals("today")) editor.putFloat("target_today", (float) newTarget);
                    else if (currentFilter.equals("month")) editor.putFloat("target_month", (float) newTarget);
                    else editor.putFloat("target_week", (float) newTarget);
                    editor.apply();
                    
                    if (currentStats != null) {
                        updateUI(currentStats);
                    }
                } else {
                    Toast.makeText(StatisticsActivity.this, "Mục tiêu phải lớn hơn 0", Toast.LENGTH_SHORT).show();
                }
            } catch (NumberFormatException e) {
                Toast.makeText(StatisticsActivity.this, "Vui lòng nhập số hợp lệ", Toast.LENGTH_SHORT).show();
            }
        });
        builder.setNegativeButton("Hủy", (dialog, which) -> dialog.cancel());
        
        builder.show();
    }

    private void fetchStatistics() {
        ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
        apiService.getStatistics(currentFilter).enqueue(new Callback<ApiService.StatisticsResponse>() {
            @Override
            public void onResponse(Call<ApiService.StatisticsResponse> call, Response<ApiService.StatisticsResponse> response) {
                if (response.isSuccessful() && response.body() != null) {
                    updateUI(response.body());
                } else {
                    Toast.makeText(StatisticsActivity.this, "Lỗi khi tải thống kê", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiService.StatisticsResponse> call, Throwable t) {
                Toast.makeText(StatisticsActivity.this, "Lỗi kết nối", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void updateUI(ApiService.StatisticsResponse stats) {
        this.currentStats = stats;
        double totalEarnings = stats.totalEarnings != null ? stats.totalEarnings.doubleValue() : 0.0;
        
        DecimalFormat formatter = new DecimalFormat("#,###");
        if (isEarningsVisible) {
            tvTotalEarnings.setText(formatter.format(totalEarnings) + "đ");
        } else {
            tvTotalEarnings.setText("******");
        }
        
        double target = getTargetEarnings();
        int progress = (int) Math.min(100, (totalEarnings / target) * 100);
        progressTarget.setProgress(progress);
        tvTargetProgress.setText(progress + "%");
        tvTargetLabel.setText("Tiến độ mục tiêu (" + formatter.format(target) + "đ)");
        
        tvCompletedOrders.setText(String.valueOf(stats.completedOrders));
        tvCancelledOrders.setText(String.valueOf(stats.cancelledOrders));
        tvActiveHours.setText(stats.activeHours + "h");
        tvRatingAvg.setText(String.format(Locale.US, "%.1f", stats.ratingAvg));
        
        llOrderHistory.removeAllViews();
        LayoutInflater inflater = LayoutInflater.from(this);
        
        if (stats.history != null) {
            for (ApiService.OrderHistory order : stats.history) {
                if (order == null) continue;
                View itemView = inflater.inflate(R.layout.item_order_history, llOrderHistory, false);
                
                TextView tvTitle = itemView.findViewById(R.id.tv_title);
                TextView tvTimeStatus = itemView.findViewById(R.id.tv_time_status);
                TextView tvFee = itemView.findViewById(R.id.tv_fee);
                TextView tvPaymentMethod = itemView.findViewById(R.id.tv_payment_method);
                View viewStatusColor = itemView.findViewById(R.id.view_status_color);
                ImageView ivIcon = itemView.findViewById(R.id.iv_icon);
                
                tvTitle.setText("Đơn hàng #" + order.id_Order + " - " + order.name_Restaurant);
                
                String timeStr = formatTime(order.delivered_At != null ? order.delivered_At : order.created_At);
                String statusText = "Hoàn thành";
                
                double fee = order.shipping_Fee != null ? order.shipping_Fee.doubleValue() : 0.0;
                
                if ("cancelled".equalsIgnoreCase(order.order_Status)) {
                    statusText = "Đã hủy";
                    if ("Driver".equals(order.cancelled_By)) {
                        statusText = "Bạn hủy";
                    } else if ("User".equals(order.cancelled_By)) {
                        statusText = "Khách hủy";
                    }
                    viewStatusColor.setBackgroundColor(0xFFD32F2F); // Red
                    ivIcon.setImageResource(android.R.drawable.ic_dialog_info);
                    tvFee.setTextColor(0xFF9E9E9E); // Gray
                    tvFee.setText(formatter.format(fee) + "đ");
                    tvPaymentMethod.setVisibility(View.GONE);
                } else {
                    viewStatusColor.setBackgroundColor(ContextCompat.getColor(this, R.color.color_primary));
                    ivIcon.setImageResource(android.R.drawable.ic_menu_myplaces);
                    tvFee.setTextColor(0xFF1A1A1A); // Black
                    tvFee.setText("+" + formatter.format(fee) + "đ");
                    
                    if ("Cash".equalsIgnoreCase(order.payment_Method)) {
                        tvPaymentMethod.setText("Tiền mặt");
                        tvPaymentMethod.setTextColor(0xFF00BFA5);
                        tvPaymentMethod.setBackgroundColor(0xFFE0F2F1);
                    } else {
                        tvPaymentMethod.setText("Đã thanh toán");
                        tvPaymentMethod.setTextColor(0xFFFF6600);
                        tvPaymentMethod.setBackgroundColor(0xFFE8F5E9);
                    }
                }
                
                tvTimeStatus.setText(timeStr + " • " + statusText);
                
                llOrderHistory.addView(itemView);
            }
        }
    }

    private String formatTime(String rawDate) {
        if (rawDate == null) return "";
        try {
            SimpleDateFormat sdfIn = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            sdfIn.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
            Date date = sdfIn.parse(rawDate);
            if (date != null) {
                SimpleDateFormat sdfOut = new SimpleDateFormat("HH:mm, dd/MM", Locale.US);
                return sdfOut.format(date);
            }
        } catch (ParseException e) {
            e.printStackTrace();
        }
        return rawDate.length() > 10 ? rawDate.substring(0, 10) : rawDate;
    }
}
