package com.example.shipper_app;

import android.os.Bundle;
import android.view.View;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.ItemTouchHelper;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.example.shipper_app.adapter.NotificationAdapter;
import com.example.shipper_app.api.ApiClient;
import com.example.shipper_app.model.api.ApiResponse;
import com.example.shipper_app.api.ApiService;
import com.example.shipper_app.model.Notification;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class NotificationActivity extends AppCompatActivity implements NotificationAdapter.OnNotificationClickListener {

    private RecyclerView rvNotifications;
    private SwipeRefreshLayout swipeRefresh;
    private ProgressBar progressBar;
    private LinearLayout layoutEmpty;
    private ImageButton btnBack;

    private NotificationAdapter adapter;
    private List<Notification> notificationList;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_notification);

        initViews();
        setupRecyclerView();
        fetchNotifications();
    }

    private void initViews() {
        rvNotifications = findViewById(R.id.rv_notifications);
        swipeRefresh = findViewById(R.id.swipe_refresh);
        progressBar = findViewById(R.id.progress_bar);
        layoutEmpty = findViewById(R.id.layout_empty);
        btnBack = findViewById(R.id.btn_back);

        btnBack.setOnClickListener(v -> finish());

        swipeRefresh.setOnRefreshListener(this::fetchNotifications);
    }

    private void setupRecyclerView() {
        notificationList = new ArrayList<>();
        adapter = new NotificationAdapter(this, notificationList, this);
        rvNotifications.setLayoutManager(new LinearLayoutManager(this));
        rvNotifications.setAdapter(adapter);

        ItemTouchHelper.SimpleCallback itemTouchHelperCallback = new ItemTouchHelper.SimpleCallback(0, ItemTouchHelper.LEFT | ItemTouchHelper.RIGHT) {
            @Override
            public boolean onMove(@NonNull RecyclerView recyclerView, @NonNull RecyclerView.ViewHolder viewHolder, @NonNull RecyclerView.ViewHolder target) {
                return false;
            }

            @Override
            public void onSwiped(@NonNull RecyclerView.ViewHolder viewHolder, int direction) {
                int position = viewHolder.getAdapterPosition();
                
                // Chỉ ẩn khỏi danh sách trên màn hình, không gọi API xóa
                notificationList.remove(position);
                adapter.notifyItemRemoved(position);
                adapter.notifyItemRangeChanged(position, notificationList.size());

                if (notificationList.isEmpty()) {
                    rvNotifications.setVisibility(View.GONE);
                    layoutEmpty.setVisibility(View.VISIBLE);
                }
            }
        };
        new ItemTouchHelper(itemTouchHelperCallback).attachToRecyclerView(rvNotifications);
    }

    private void fetchNotifications() {
        if (!swipeRefresh.isRefreshing()) {
            progressBar.setVisibility(View.VISIBLE);
        }
        
        ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
        apiService.getNotifications().enqueue(new Callback<List<Notification>>() {
            @Override
            public void onResponse(Call<List<Notification>> call, Response<List<Notification>> response) {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);

                if (response.isSuccessful() && response.body() != null) {
                    notificationList.clear();
                    notificationList.addAll(response.body());
                    adapter.notifyDataSetChanged();
                    
                    if (notificationList.isEmpty()) {
                        rvNotifications.setVisibility(View.GONE);
                        layoutEmpty.setVisibility(View.VISIBLE);
                    } else {
                        rvNotifications.setVisibility(View.VISIBLE);
                        layoutEmpty.setVisibility(View.GONE);
                    }
                } else {
                    Toast.makeText(NotificationActivity.this, "Lỗi lấy thông báo", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<List<Notification>> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);
                Toast.makeText(NotificationActivity.this, "Lỗi mạng: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    public void onNotificationClick(Notification notification, int position) {
        if (!notification.isRead()) {
            // Đánh dấu là đã đọc
            notification.setRead(true);
            adapter.notifyItemChanged(position);

            ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
            apiService.markNotificationRead(notification.getIdNoti()).enqueue(new Callback<ApiResponse>() {
                @Override
                public void onResponse(Call<ApiResponse> call, Response<ApiResponse> response) {
                    // Cập nhật ngầm
                }

                @Override
                public void onFailure(Call<ApiResponse> call, Throwable t) {
                    // Log lỗi
                }
            });
        }
        
        // Có thể thêm logic chuyển sang màn hình chi tiết đơn hàng nếu muốn:
        // if (notification.getRelatedOrderId() != null) { ... }
    }

    @Override
    public void onDeleteClick(Notification notification, int position) {
        // Xóa khỏi danh sách tạm để UI phản hồi nhanh
        notificationList.remove(position);
        adapter.notifyItemRemoved(position);
        adapter.notifyItemRangeChanged(position, notificationList.size());

        if (notificationList.isEmpty()) {
            rvNotifications.setVisibility(View.GONE);
            layoutEmpty.setVisibility(View.VISIBLE);
        }

        // Gọi API xóa trên server
        ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
        apiService.deleteNotification(notification.getIdNoti()).enqueue(new Callback<ApiResponse>() {
            @Override
            public void onResponse(Call<ApiResponse> call, Response<ApiResponse> response) {
                if (!response.isSuccessful()) {
                    Toast.makeText(NotificationActivity.this, "Lỗi xóa thông báo trên server", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse> call, Throwable t) {
                Toast.makeText(NotificationActivity.this, "Lỗi kết nối", Toast.LENGTH_SHORT).show();
            }
        });
    }
}
