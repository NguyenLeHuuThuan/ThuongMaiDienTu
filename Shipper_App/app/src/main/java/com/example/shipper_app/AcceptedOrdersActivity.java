package com.example.shipper_app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.widget.EditText;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.drawerlayout.widget.DrawerLayout;
import androidx.core.view.GravityCompat;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import com.google.android.material.navigation.NavigationView;
import android.widget.TextView;

import com.example.shipper_app.adapter.AcceptedOrderAdapter;
import com.example.shipper_app.api.ApiClient;
import com.example.shipper_app.api.ApiService;
import com.example.shipper_app.model.Order;
import com.example.shipper_app.model.api.ApiResponse;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class AcceptedOrdersActivity extends AppCompatActivity implements AcceptedOrderAdapter.OnAcceptedOrderClickListener {

    private RecyclerView rvAcceptedOrders;
    private AcceptedOrderAdapter adapter;
    private SwipeRefreshLayout swipeRefresh;
    private View layoutEmpty;
    private DrawerLayout drawerLayout;
    private NavigationView navView;
    private com.google.android.material.tabs.TabLayout tabLayout;
    private List<Order> allAcceptedOrders = new ArrayList<>();
    private List<Order> displayOrders = new ArrayList<>();

    private android.os.Handler pollingHandler;
    private Runnable pollingRunnable;
    private static final int POLLING_INTERVAL = 3000;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_accepted_orders);

        Toolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);

        initViews();
        setupRecyclerView();

        toolbar.setNavigationOnClickListener(v -> {
            if (drawerLayout != null) {
                drawerLayout.openDrawer(GravityCompat.START);
            }
        });

        pollingHandler = new android.os.Handler(android.os.Looper.getMainLooper());
        pollingRunnable = new Runnable() {
            @Override
            public void run() {
                fetchAcceptedOrders(false);
                pollingHandler.postDelayed(this, POLLING_INTERVAL);
            }
        };
    }

    @Override
    protected void onResume() {
        super.onResume();
        fetchAcceptedOrders(true);
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
        rvAcceptedOrders = findViewById(R.id.rv_accepted_orders);
        swipeRefresh = findViewById(R.id.swipe_refresh);
        layoutEmpty = findViewById(R.id.layout_empty);
        drawerLayout = findViewById(R.id.drawer_layout);
        navView = findViewById(R.id.nav_view);

        swipeRefresh.setOnRefreshListener(this::fetchAcceptedOrders);

        tabLayout = findViewById(R.id.tab_layout);
        tabLayout.addTab(tabLayout.newTab().setText("Tất cả"));
        tabLayout.addTab(tabLayout.newTab().setText("Đang lấy hàng"));
        tabLayout.addTab(tabLayout.newTab().setText("Đang giao hàng"));
        tabLayout.addTab(tabLayout.newTab().setText("Đã giao hàng"));

        tabLayout.addOnTabSelectedListener(new com.google.android.material.tabs.TabLayout.OnTabSelectedListener() {
            @Override
            public void onTabSelected(com.google.android.material.tabs.TabLayout.Tab tab) {
                filterOrders();
            }

            @Override
            public void onTabUnselected(com.google.android.material.tabs.TabLayout.Tab tab) {}

            @Override
            public void onTabReselected(com.google.android.material.tabs.TabLayout.Tab tab) {}
        });

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
                android.content.Intent intent = new android.content.Intent(AcceptedOrdersActivity.this, ProfileActivity.class);
                startActivity(intent);
                drawerLayout.closeDrawer(androidx.core.view.GravityCompat.START);
            });

            navView.setCheckedItem(R.id.nav_orders);

            navView.setNavigationItemSelectedListener(item -> {
                int id = item.getItemId();
                if (id == R.id.nav_home) {
                    finish();
                } else if (id == R.id.nav_orders) {
                    // Current activity
                } else if (id == R.id.nav_chat) {
                    Intent intent = new Intent(AcceptedOrdersActivity.this, ChatActivity.class);
                    startActivity(intent);
                    finish();
                } else if (id == R.id.nav_statistics) {
                    Intent intent = new Intent(AcceptedOrdersActivity.this, StatisticsActivity.class);
                    startActivity(intent);
                    finish();
                } else if (id == R.id.nav_issues) {
                    Intent intent = new Intent(AcceptedOrdersActivity.this, IssueActivity.class);
                    startActivity(intent);
                    finish();
                } else if (id == R.id.nav_wallet) {
                    Intent intent = new Intent(AcceptedOrdersActivity.this, WalletActivity.class);
                    startActivity(intent);
                    finish();
                } else if (id == R.id.nav_logout) {
                    // Xóa token và đăng xuất
                    SharedPreferences prefsLogout = getSharedPreferences("ShipperAppPrefs", Context.MODE_PRIVATE);
                    prefsLogout.edit().clear().apply();
                    
                    Intent intent = new Intent(AcceptedOrdersActivity.this, LoginActivity.class);
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
        adapter = new AcceptedOrderAdapter(this, displayOrders, this);
        rvAcceptedOrders.setLayoutManager(new LinearLayoutManager(this));
        rvAcceptedOrders.setAdapter(adapter);
    }

    private void fetchAcceptedOrders() {
        fetchAcceptedOrders(true);
    }

    private void fetchAcceptedOrders(boolean showErrorsAndLoading) {
        if (showErrorsAndLoading) {
            swipeRefresh.setRefreshing(true);
        }
        ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
        
        apiService.getAcceptedOrders().enqueue(new Callback<List<Order>>() {
            @Override
            public void onResponse(Call<List<Order>> call, Response<List<Order>> response) {
                if (showErrorsAndLoading) {
                    swipeRefresh.setRefreshing(false);
                }
                if (response.isSuccessful() && response.body() != null) {
                    allAcceptedOrders.clear();
                    allAcceptedOrders.addAll(response.body());
                    filterOrders();
                } else {
                    if (showErrorsAndLoading) {
                        Toast.makeText(AcceptedOrdersActivity.this, "Không thể tải danh sách đơn hàng", Toast.LENGTH_SHORT).show();
                    }
                }
            }

            @Override
            public void onFailure(Call<List<Order>> call, Throwable t) {
                if (showErrorsAndLoading) {
                    swipeRefresh.setRefreshing(false);
                    Toast.makeText(AcceptedOrdersActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    private void filterOrders() {
        displayOrders.clear();
        int selectedTab = tabLayout.getSelectedTabPosition();
        
        for (Order order : allAcceptedOrders) {
            String status = order.getOrderStatus();
            if (status == null) status = "";
            status = status.toLowerCase();

            boolean matches = false;
            if (selectedTab == 0) { // Tất cả (Đã nhận như trang hiện tại)
                if (status.equals("picking") || status.equals("delivering") || status.equals("ready")) {
                    matches = true;
                }
            } else if (selectedTab == 1) { // Đang lấy hàng
                if (status.equals("picking") || status.equals("waiting_pickup") || status.equals("ready")) {
                    matches = true;
                }
            } else if (selectedTab == 2) { // Đang giao hàng
                if (status.equals("delivering")) {
                    matches = true;
                }
            } else if (selectedTab == 3) { // Đã giao hàng
                if (status.equals("delivered")) {
                    matches = true;
                }
            }

            if (matches) {
                displayOrders.add(order);
            }
        }
        
        adapter.notifyDataSetChanged();
        updateUI();
    }

    private void updateUI() {
        if (displayOrders.isEmpty()) {
            rvAcceptedOrders.setVisibility(View.GONE);
            layoutEmpty.setVisibility(View.VISIBLE);
        } else {
            rvAcceptedOrders.setVisibility(View.VISIBLE);
            layoutEmpty.setVisibility(View.GONE);
        }
    }

    @Override
    public void onCancelOrder(Order order) {
        showCancelDialog(order);
    }

    @Override
    public void onViewOrderDetail(Order order) {
        Intent intent = new Intent(this, OrderDetailActivity.class);
        intent.putExtra(HomeActivity.EXTRA_ORDER, order);
        startActivity(intent);
    }

    private void showCancelDialog(Order order) {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Hủy giao hàng");
        builder.setMessage("Vui lòng nhập lý do bạn muốn hủy đơn hàng này:");

        final EditText input = new EditText(this);
        input.setHint("Lý do hủy (bắt buộc)");
        builder.setView(input);

        builder.setPositiveButton("Xác nhận hủy", null); // Override later to prevent auto-close
        builder.setNegativeButton("Quay lại", (dialog, which) -> dialog.cancel());

        AlertDialog dialog = builder.create();
        dialog.show();

        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String reason = input.getText().toString().trim();
            if (TextUtils.isEmpty(reason)) {
                input.setError("Lý do hủy không được để trống");
            } else {
                callCancelApi(order.getIdOrder(), reason);
                dialog.dismiss();
            }
        });
    }

    private void callCancelApi(int orderId, String reason) {
        ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
        ApiService.CancelRequest request = new ApiService.CancelRequest(reason);

        apiService.cancelOrder(orderId, request).enqueue(new Callback<ApiResponse>() {
            @Override
            public void onResponse(Call<ApiResponse> call, Response<ApiResponse> response) {
                if (response.isSuccessful()) {
                    // Hiển thị popup thông báo
                    com.example.shipper_app.utils.NotificationHelper.showTopPopup(AcceptedOrdersActivity.this, 
                        "🔔 Thông báo mới", 
                        "Bạn đã hủy giao đơn hàng #" + orderId);
                        
                    fetchAcceptedOrders(); // Tải lại danh sách
                } else {
                    Toast.makeText(AcceptedOrdersActivity.this, "Lỗi khi hủy đơn hàng", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse> call, Throwable t) {
                Toast.makeText(AcceptedOrdersActivity.this, "Lỗi kết nối", Toast.LENGTH_SHORT).show();
            }
        });
    }
}
