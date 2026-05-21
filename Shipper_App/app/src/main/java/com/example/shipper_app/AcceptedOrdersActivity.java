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
    private List<Order> acceptedOrders = new ArrayList<>();

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
    }

    @Override
    protected void onResume() {
        super.onResume();
        fetchAcceptedOrders();
    }

    private void initViews() {
        rvAcceptedOrders = findViewById(R.id.rv_accepted_orders);
        swipeRefresh = findViewById(R.id.swipe_refresh);
        layoutEmpty = findViewById(R.id.layout_empty);
        drawerLayout = findViewById(R.id.drawer_layout);
        navView = findViewById(R.id.nav_view);

        swipeRefresh.setOnRefreshListener(this::fetchAcceptedOrders);

        if (navView != null) {
            View headerView = navView.getHeaderView(0);
            TextView tvDriverName = headerView.findViewById(R.id.tv_driver_name);
            
            SharedPreferences prefs = getSharedPreferences("ShipperAppPrefs", Context.MODE_PRIVATE);
            String driverName = prefs.getString("driverName", "Tài xế");
            if (tvDriverName != null) {
                tvDriverName.setText(driverName);
            }

            navView.setCheckedItem(R.id.nav_orders);

            navView.setNavigationItemSelectedListener(item -> {
                int id = item.getItemId();
                if (id == R.id.nav_home) {
                    finish();
                }
                
                drawerLayout.closeDrawer(GravityCompat.START);
                return true;
            });
        }
    }

    private void setupRecyclerView() {
        adapter = new AcceptedOrderAdapter(this, acceptedOrders, this);
        rvAcceptedOrders.setLayoutManager(new LinearLayoutManager(this));
        rvAcceptedOrders.setAdapter(adapter);
    }

    private void fetchAcceptedOrders() {
        swipeRefresh.setRefreshing(true);
        ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
        
        apiService.getAcceptedOrders().enqueue(new Callback<List<Order>>() {
            @Override
            public void onResponse(Call<List<Order>> call, Response<List<Order>> response) {
                swipeRefresh.setRefreshing(false);
                if (response.isSuccessful() && response.body() != null) {
                    acceptedOrders.clear();
                    acceptedOrders.addAll(response.body());
                    adapter.notifyDataSetChanged();
                    updateUI();
                } else {
                    Toast.makeText(AcceptedOrdersActivity.this, "Không thể tải danh sách đơn hàng", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<List<Order>> call, Throwable t) {
                swipeRefresh.setRefreshing(false);
                Toast.makeText(AcceptedOrdersActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void updateUI() {
        if (acceptedOrders.isEmpty()) {
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
                    Toast.makeText(AcceptedOrdersActivity.this, "Đã hủy đơn hàng", Toast.LENGTH_SHORT).show();
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
