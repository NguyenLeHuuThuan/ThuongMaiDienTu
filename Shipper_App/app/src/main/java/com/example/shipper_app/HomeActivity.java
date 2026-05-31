package com.example.shipper_app;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.drawerlayout.widget.DrawerLayout;
import androidx.core.view.GravityCompat;
import com.google.android.material.navigation.NavigationView;
import android.content.SharedPreferences;
import android.content.Context;
import android.widget.ImageButton;

import com.example.shipper_app.api.ApiClient;
import com.example.shipper_app.api.ApiService;
import com.example.shipper_app.adapter.OrderAdapter;
import com.example.shipper_app.model.Order;
import com.example.shipper_app.model.api.ApiResponse;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * HomeActivity - Màn hình chính hiển thị danh sách đơn hàng chờ nhận
 * Ánh xạ với activity_home.xml
 */
public class HomeActivity extends AppCompatActivity implements OrderAdapter.OnOrderClickListener {

    // Key để truyền dữ liệu sang OrderDetailActivity
    public static final String EXTRA_ORDER = "extra_order";

    private RecyclerView rvOrders;
    private OrderAdapter orderAdapter;
    private TextView tvOrderCount;
    private TextView tvTodayEarnings;
    private View layoutEmpty;
    private DrawerLayout drawerLayout;
    private ImageButton btnMenu;
    private NavigationView navView;

    private List<Order> pendingOrders = new ArrayList<>();
    private final java.util.Set<Integer> notifiedReadyOrders = new java.util.HashSet<>();

    // Variables for auto-refresh
    private final android.os.Handler refreshHandler = new android.os.Handler(android.os.Looper.getMainLooper());
    private Runnable refreshRunnable;
    private static final long REFRESH_INTERVAL = 5000; // 5 seconds

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_home);

        initViews();
        setupRecyclerView();
        fetchAvailableOrders();
        fetchTodayEarnings();
    }

    private void initViews() {
        rvOrders = findViewById(R.id.rv_orders);
        tvOrderCount = findViewById(R.id.tv_order_count);
        tvTodayEarnings = findViewById(R.id.tv_today_earnings);
        layoutEmpty = findViewById(R.id.layout_empty);
        drawerLayout = findViewById(R.id.drawer_layout);
        btnMenu = findViewById(R.id.btn_menu);
        navView = findViewById(R.id.nav_view);

        // Bắt sự kiện bấm nút Menu để mở Sidebar
        btnMenu.setOnClickListener(v -> {
            if (drawerLayout != null) {
                drawerLayout.openDrawer(GravityCompat.START);
            }
        });

        // Bắt sự kiện bấm nút Thông báo
        ImageButton btnNotifications = findViewById(R.id.btn_notifications);
        if (btnNotifications != null) {
            btnNotifications.setOnClickListener(v -> {
                Intent intent = new Intent(HomeActivity.this, NotificationActivity.class);
                startActivity(intent);
            });
        }

        // Lấy tên tài xế hiển thị lên Sidebar Header
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
            
            fetchDriverProfile();

            // Click header to open profile
            headerView.setOnClickListener(v -> {
                Intent intent = new Intent(HomeActivity.this, ProfileActivity.class);
                startActivity(intent);
                drawerLayout.closeDrawer(GravityCompat.START);
            });

            // Xử lý sự kiện click menu
            navView.setNavigationItemSelectedListener(item -> {
                int id = item.getItemId();
                if (id == R.id.nav_orders) {
                    // Mở màn hình Đơn đã nhận
                    Intent intent = new Intent(HomeActivity.this, AcceptedOrdersActivity.class);
                    startActivity(intent);
                } else if (id == R.id.nav_statistics) {
                    Intent intent = new Intent(HomeActivity.this, StatisticsActivity.class);
                    startActivity(intent);
                } else if (id == R.id.nav_issues) {
                    Intent intent = new Intent(HomeActivity.this, IssueActivity.class);
                    startActivity(intent);
                } else if (id == R.id.nav_chat) {
                    Intent intent = new Intent(HomeActivity.this, ChatActivity.class);
                    startActivity(intent);
                } else if (id == R.id.nav_wallet) {
                    Intent intent = new Intent(HomeActivity.this, WalletActivity.class);
                    startActivity(intent);
                } else if (id == R.id.nav_logout) {
                    // Xóa token và đăng xuất
                    SharedPreferences prefsLogout = getSharedPreferences("ShipperAppPrefs", Context.MODE_PRIVATE);
                    prefsLogout.edit().clear().apply();
                    
                    Intent intent = new Intent(HomeActivity.this, LoginActivity.class);
                    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                    startActivity(intent);
                    finish();
                }
                
                drawerLayout.closeDrawer(GravityCompat.START);
                return true;
            });
        }
    }

    private void setupRecyclerView() {
        orderAdapter = new OrderAdapter(this, pendingOrders, this);
        rvOrders.setLayoutManager(new LinearLayoutManager(this));
        rvOrders.setAdapter(orderAdapter);
        rvOrders.setNestedScrollingEnabled(false);

        updateUI();
    }

    /**
     * Gọi API lấy danh sách đơn hàng chờ nhận từ backend
     */
    private void fetchAvailableOrders() {
        ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
        
        apiService.getAvailableOrders().enqueue(new Callback<List<Order>>() {
            @Override
            public void onResponse(Call<List<Order>> call, Response<List<Order>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    pendingOrders.clear();
                    pendingOrders.addAll(response.body());
                    orderAdapter.notifyDataSetChanged();
                    updateUI();

                    // Hiển thị thông báo cho các đơn có thể đến lấy hàng
                    for (Order order : pendingOrders) {
                        if (order.getReadyAt() != null) {
                            String status = order.getOrderStatus();
                            if (status != null) {
                                String lowerStatus = status.toLowerCase();
                                if (!lowerStatus.equals("pending") && 
                                    !lowerStatus.equals("preparing") && 
                                    !lowerStatus.equals("delivering") && 
                                    !lowerStatus.equals("delivered")) {
                                    
                                    if (!notifiedReadyOrders.contains(order.getIdOrder())) {
                                        notifiedReadyOrders.add(order.getIdOrder());
                                        com.example.shipper_app.utils.NotificationHelper.showTopPopup(
                                            HomeActivity.this, 
                                            "🔔 Đơn hàng sẵn sàng", 
                                            "Đơn hàng #" + order.getOrderCode() + " có thể đến lấy"
                                        );
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // Xử lý khi có lỗi (không hiển thị toast liên tục để tránh làm phiền)
                }
            }

            @Override
            public void onFailure(Call<List<Order>> call, Throwable t) {
                // Không hiển thị toast lỗi mạng liên tục khi auto-refresh để tránh làm phiền UX
            }
        });
    }

    private void fetchTodayEarnings() {
        ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
        apiService.getTodayEarnings().enqueue(new Callback<ApiService.EarningsResponse>() {
            @Override
            public void onResponse(Call<ApiService.EarningsResponse> call, Response<ApiService.EarningsResponse> response) {
                if (response.isSuccessful() && response.body() != null) {
                    java.math.BigDecimal earnings = response.body().todayEarnings;
                    if (earnings == null) earnings = new java.math.BigDecimal("0");
                    tvTodayEarnings.setText(Order.formatCurrency(earnings));
                } else {
                    android.util.Log.e("fetchTodayEarnings", "Lỗi API: " + response.code());
                    tvTodayEarnings.setText("Lỗi");
                }
            }

            @Override
            public void onFailure(Call<ApiService.EarningsResponse> call, Throwable t) {
                android.util.Log.e("fetchTodayEarnings", "Lỗi kết nối: " + t.getMessage());
                tvTodayEarnings.setText("Lỗi");
            }
        });
    }

    /**
     * Cập nhật UI khi danh sách thay đổi
     */
    private void updateUI() {
        int count = pendingOrders.size();
        tvOrderCount.setText(String.valueOf(count));

        if (count == 0) {
            rvOrders.setVisibility(View.GONE);
            layoutEmpty.setVisibility(View.VISIBLE);
        } else {
            rvOrders.setVisibility(View.VISIBLE);
            layoutEmpty.setVisibility(View.GONE);
        }
    }

    /**
     * Callback khi shipper nhấn "Nhận đơn"
     * Chuyển sang màn hình chi tiết đơn hàng
     */
    @Override
    public void onAcceptOrder(Order order) {
        // Gọi API nhận đơn hàng
        ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
        apiService.acceptOrder(order.getIdOrder()).enqueue(new Callback<ApiResponse>() {
            @Override
            public void onResponse(Call<ApiResponse> call, Response<ApiResponse> response) {
                if (response.isSuccessful()) {
                    // Cập nhật trạng thái đơn hàng cục bộ
                    order.setOrderStatus("picking");
                    java.util.Date now = new java.util.Date();
                    order.setAcceptedAt(now);
                    // Cập nhật lại thời gian dự kiến (hiện tại + 15 phút)
                    order.setExpectedCompletionTime(new java.util.Date(now.getTime() + 15 * 60 * 1000));

                    // Chuyển sang màn hình chi tiết
                    Intent intent = new Intent(HomeActivity.this, OrderDetailActivity.class);
                    intent.putExtra(EXTRA_ORDER, order);
                    startActivity(intent);

                    // Animation chuyển màn hình
                    overridePendingTransition(android.R.anim.slide_in_left, android.R.anim.slide_out_right);
                } else {
                    try {
                        String errorMsg = "Không thể nhận đơn hàng này";
                        if (response.errorBody() != null) {
                            String errorBodyStr = response.errorBody().string();
                            org.json.JSONObject errorJson = new org.json.JSONObject(errorBodyStr);
                            if (errorJson.has("message")) {
                                errorMsg = errorJson.getString("message");
                            }
                        }
                        Toast.makeText(HomeActivity.this, errorMsg, Toast.LENGTH_LONG).show();
                    } catch (Exception e) {
                        Toast.makeText(HomeActivity.this, "Không thể nhận đơn hàng này", Toast.LENGTH_SHORT).show();
                    }
                    // Load lại danh sách vì có thể người khác đã nhận hoặc lỗi ví
                    fetchAvailableOrders();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse> call, Throwable t) {
                Toast.makeText(HomeActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    /**
     * Callback khi shipper nhấn vào card để xem chi tiết
     */
    @Override
    public void onViewOrderDetail(Order order) {
        Intent intent = new Intent(HomeActivity.this, OrderDetailActivity.class);
        intent.putExtra(EXTRA_ORDER, order);
        startActivity(intent);
        overridePendingTransition(android.R.anim.slide_in_left, android.R.anim.slide_out_right);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Refresh danh sách khi quay lại từ màn hình chi tiết
        fetchAvailableOrders();
        startAutoRefresh();
        
        // Cập nhật profile trên header
        fetchDriverProfile();
    }

    @Override
    protected void onPause() {
        super.onPause();
        stopAutoRefresh();
    }

    private void startAutoRefresh() {
        if (refreshRunnable == null) {
            refreshRunnable = new Runnable() {
                @Override
                public void run() {
                    fetchAvailableOrders();
                    refreshHandler.postDelayed(this, REFRESH_INTERVAL);
                }
            };
        }
        refreshHandler.postDelayed(refreshRunnable, REFRESH_INTERVAL);
    }

    private void stopAutoRefresh() {
        if (refreshRunnable != null) {
            refreshHandler.removeCallbacks(refreshRunnable);
        }
    }

    private void fetchDriverProfile() {
        if (navView != null) {
            ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
            apiService.getProfile().enqueue(new Callback<ApiService.ProfileResponse>() {
                @Override
                public void onResponse(Call<ApiService.ProfileResponse> call, Response<ApiService.ProfileResponse> response) {
                    if (response.isSuccessful() && response.body() != null) {
                        ApiService.ProfileResponse profile = response.body();
                        View headerView = navView.getHeaderView(0);
                        if (headerView != null) {
                            TextView tvDriverName = headerView.findViewById(R.id.tv_driver_name);
                            if (tvDriverName != null && profile.fullName != null) {
                                tvDriverName.setText(profile.fullName);
                                getSharedPreferences("ShipperAppPrefs", Context.MODE_PRIVATE)
                                    .edit().putString("driverName", profile.fullName).apply();
                            }
                            
                            android.widget.ImageView ivAvatar = headerView.findViewById(R.id.iv_driver_avatar);
                            if (ivAvatar != null && profile.avatar != null && !profile.avatar.isEmpty()) {
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
                                    } catch (Exception e) {}
                                }).start();
                            }
                        }
                    }
                }
                @Override
                public void onFailure(Call<ApiService.ProfileResponse> call, Throwable t) {}
            });
        }
    }
}
