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

import com.github.mikephil.charting.charts.LineChart;
import com.github.mikephil.charting.components.XAxis;
import com.github.mikephil.charting.data.Entry;
import com.github.mikephil.charting.data.LineData;
import com.github.mikephil.charting.data.LineDataSet;

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
    
    private TextView tvViewAllOrders;
    private LineChart lineChart;
    
    private TextView tabToday, tabWeek, tabMonth;
    private String currentFilter = "week"; // Default
    private boolean isEarningsVisible = true;
    private ApiService.StatisticsResponse currentStats;

    private android.os.Handler pollingHandler;
    private Runnable pollingRunnable;
    private static final int POLLING_INTERVAL = 3000;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_statistics);

        initViews();
        setupTabs();
        fetchStatistics(true);

        pollingHandler = new android.os.Handler(android.os.Looper.getMainLooper());
        pollingRunnable = new Runnable() {
            @Override
            public void run() {
                fetchStatistics(false);
                pollingHandler.postDelayed(this, POLLING_INTERVAL);
            }
        };
    }

    @Override
    protected void onResume() {
        super.onResume();
        fetchStatistics(true);
        if (pollingHandler != null) {
            pollingHandler.postDelayed(pollingRunnable, POLLING_INTERVAL);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (pollingHandler != null) {
            pollingHandler.removeCallbacks(pollingRunnable);
        }
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
        
        tvViewAllOrders = findViewById(R.id.tv_view_all_orders);
        if (tvViewAllOrders != null) {
            tvViewAllOrders.setOnClickListener(v -> {
                Intent intent = new Intent(StatisticsActivity.this, AcceptedOrdersActivity.class);
                startActivity(intent);
            });
        }
        
        lineChart = findViewById(R.id.line_chart);
        setupChart();

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

            android.widget.ImageView ivAvatar = headerView.findViewById(R.id.iv_driver_avatar);
            String avatarUrl = prefs.getString("driverAvatar", "");
            if (ivAvatar != null && !avatarUrl.isEmpty()) {
                new Thread(() -> {
                    try {
                        java.io.InputStream in = new java.net.URL(avatarUrl).openStream();
                        android.graphics.Bitmap bmp = android.graphics.BitmapFactory.decodeStream(in);
                        runOnUiThread(() -> {
                            if (bmp != null) ivAvatar.setImageBitmap(bmp);
                        });
                    } catch (Exception e) {}
                }).start();
            }

            headerView.setOnClickListener(v -> {
                android.content.Intent intent = new android.content.Intent(StatisticsActivity.this, ProfileActivity.class);
                startActivity(intent);
                drawerLayout.closeDrawer(androidx.core.view.GravityCompat.START);
            });

            navView.setCheckedItem(R.id.nav_statistics);

            navView.setNavigationItemSelectedListener(item -> {
                int id = item.getItemId();
                if (id == R.id.nav_home) {
                    finish();
                } else if (id == R.id.nav_orders) {
                    Intent intent = new Intent(StatisticsActivity.this, AcceptedOrdersActivity.class);
                    startActivity(intent);
                    finish();
                } else if (id == R.id.nav_chat) {
                    Intent intent = new Intent(StatisticsActivity.this, ChatActivity.class);
                    startActivity(intent);
                    finish();
                } else if (id == R.id.nav_statistics) {
                    // Current activity
                } else if (id == R.id.nav_issues) {
                    Intent intent = new Intent(StatisticsActivity.this, IssueActivity.class);
                    startActivity(intent);
                    finish();
                } else if (id == R.id.nav_wallet) {
                    Intent intent = new Intent(StatisticsActivity.this, WalletActivity.class);
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
        updateChartData(filter);
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

    private void setupChart() {
        if (lineChart == null) return;
        lineChart.getDescription().setEnabled(false);
        lineChart.setDrawGridBackground(false);
        lineChart.getAxisRight().setEnabled(false);
        lineChart.getLegend().setEnabled(false);
        
        XAxis xAxis = lineChart.getXAxis();
        xAxis.setPosition(XAxis.XAxisPosition.BOTTOM);
        xAxis.setDrawGridLines(false);
        xAxis.setGranularity(1f);
        
        lineChart.getAxisLeft().setDrawGridLines(true);
        lineChart.setTouchEnabled(true);
        lineChart.animateX(1000);
    }

    private void updateChartData(String filter) {
        if (lineChart == null) return;
        java.util.List<Entry> entries = new java.util.ArrayList<>();
        final String[] labels;
        
        if (filter.equals("today")) {
            labels = new String[]{"8h", "10h", "12h", "14h", "16h", "18h", "20h"};
            entries.add(new Entry(0, 50000));
            entries.add(new Entry(1, 120000));
            entries.add(new Entry(2, 250000));
            entries.add(new Entry(3, 180000));
            entries.add(new Entry(4, 210000));
            entries.add(new Entry(5, 300000));
            entries.add(new Entry(6, 400000));
        } else if (filter.equals("month")) {
            labels = new String[]{"Tuần 1", "Tuần 2", "Tuần 3", "Tuần 4"};
            entries.add(new Entry(0, 2000000));
            entries.add(new Entry(1, 3500000));
            entries.add(new Entry(2, 2800000));
            entries.add(new Entry(3, 4200000));
        } else { // week
            labels = new String[]{"T2", "T3", "T4", "T5", "T6", "T7", "CN"};
            entries.add(new Entry(0, 300000));
            entries.add(new Entry(1, 450000));
            entries.add(new Entry(2, 380000));
            entries.add(new Entry(3, 500000));
            entries.add(new Entry(4, 420000));
            entries.add(new Entry(5, 600000));
            entries.add(new Entry(6, 750000));
        }
        
        LineDataSet dataSet = new LineDataSet(entries, "Doanh thu");
        dataSet.setColor(ContextCompat.getColor(this, R.color.color_primary));
        dataSet.setCircleColor(ContextCompat.getColor(this, R.color.color_primary));
        dataSet.setLineWidth(2f);
        dataSet.setCircleRadius(4f);
        dataSet.setDrawValues(false);
        dataSet.setMode(LineDataSet.Mode.CUBIC_BEZIER);
        
        // Fill effect
        dataSet.setDrawFilled(true);
        dataSet.setFillColor(ContextCompat.getColor(this, R.color.color_primary));
        dataSet.setFillAlpha(50);
        
        LineData lineData = new LineData(dataSet);
        lineChart.setData(lineData);
        
        lineChart.getXAxis().setValueFormatter(new com.github.mikephil.charting.formatter.IndexAxisValueFormatter(labels));
        lineChart.invalidate();
        lineChart.animateX(1000);
    }

    private void fetchStatistics() {
        fetchStatistics(true);
    }

    private void fetchStatistics(boolean showErrors) {
        ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
        apiService.getStatistics(currentFilter).enqueue(new Callback<ApiService.StatisticsResponse>() {
            @Override
            public void onResponse(Call<ApiService.StatisticsResponse> call, Response<ApiService.StatisticsResponse> response) {
                if (response.isSuccessful() && response.body() != null) {
                    updateUI(response.body());
                } else {
                    if (showErrors) {
                        Toast.makeText(StatisticsActivity.this, "Lỗi khi tải thống kê", Toast.LENGTH_SHORT).show();
                    }
                }
            }

            @Override
            public void onFailure(Call<ApiService.StatisticsResponse> call, Throwable t) {
                if (showErrors) {
                    Toast.makeText(StatisticsActivity.this, "Lỗi kết nối", Toast.LENGTH_SHORT).show();
                }
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
        double rawProgress = (totalEarnings / target) * 100.0;
        if (rawProgress > 100) rawProgress = 100.0;
        
        int progressInt = (int) rawProgress;
        if (totalEarnings > 0 && progressInt == 0) {
            progressInt = 1; // Hiện một chút xíu thanh tiến độ nếu đã có doanh thu
        }
        progressTarget.setProgress(progressInt);
        
        DecimalFormat percentFormat = new DecimalFormat("0.##");
        tvTargetProgress.setText(percentFormat.format(rawProgress) + "%");
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
                    ivIcon.setImageResource(R.drawable.ic_delivery_truck);
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
