package com.example.shipper_app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.ImageButton;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.GravityCompat;
import androidx.drawerlayout.widget.DrawerLayout;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.navigation.NavigationView;

import com.example.shipper_app.adapter.ChatAdapter;
import com.example.shipper_app.api.ApiClient;
import com.example.shipper_app.api.ApiService;
import com.example.shipper_app.model.ChatSession;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ChatActivity extends AppCompatActivity {

    private RecyclerView rvChat;
    private ChatAdapter chatAdapter;
    private List<ChatSession> chatList;

    private android.os.Handler pollingHandler;
    private Runnable pollingRunnable;
    private static final int POLLING_INTERVAL = 3000;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_chat);

        DrawerLayout drawerLayout = findViewById(R.id.drawer_layout);
        NavigationView navView = findViewById(R.id.nav_view);

        ImageButton btnMenu = findViewById(R.id.btn_menu);
        btnMenu.setOnClickListener(v -> {
            if (drawerLayout != null) {
                drawerLayout.openDrawer(GravityCompat.START);
            }
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
                Intent intent = new Intent(ChatActivity.this, ProfileActivity.class);
                startActivity(intent);
                drawerLayout.closeDrawer(GravityCompat.START);
            });

            navView.setNavigationItemSelectedListener(item -> {
                int id = item.getItemId();
                if (id == R.id.nav_home) {
                    finish();
                } else if (id == R.id.nav_orders) {
                    Intent intent = new Intent(ChatActivity.this, AcceptedOrdersActivity.class);
                    startActivity(intent);
                    finish();
                } else if (id == R.id.nav_statistics) {
                    Intent intent = new Intent(ChatActivity.this, StatisticsActivity.class);
                    startActivity(intent);
                    finish();
                } else if (id == R.id.nav_issues) {
                    Intent intent = new Intent(ChatActivity.this, IssueActivity.class);
                    startActivity(intent);
                    finish();
                } else if (id == R.id.nav_chat) {
                    // Current activity
                } else if (id == R.id.nav_wallet) {
                    Intent intent = new Intent(ChatActivity.this, WalletActivity.class);
                    startActivity(intent);
                    finish();
                } else if (id == R.id.nav_logout) {
                    SharedPreferences prefsLogout = getSharedPreferences("ShipperAppPrefs", Context.MODE_PRIVATE);
                    prefsLogout.edit().clear().apply();
                    
                    Intent intent = new Intent(ChatActivity.this, LoginActivity.class);
                    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                    startActivity(intent);
                    finish();
                }
                
                drawerLayout.closeDrawer(GravityCompat.START);
                return true;
            });
        }

        rvChat = findViewById(R.id.rv_chat);
        rvChat.setLayoutManager(new LinearLayoutManager(this));

        chatList = new ArrayList<>();
        chatAdapter = new ChatAdapter(this, chatList);
        rvChat.setAdapter(chatAdapter);

        loadConversations(true);

        pollingHandler = new android.os.Handler(android.os.Looper.getMainLooper());
        pollingRunnable = new Runnable() {
            @Override
            public void run() {
                loadConversations(false);
                pollingHandler.postDelayed(this, POLLING_INTERVAL);
            }
        };
    }
    
    @Override
    protected void onResume() {
        super.onResume();
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
    
    private void loadConversations(boolean showErrors) {
        ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
        apiService.getConversations().enqueue(new Callback<List<ApiService.ChatConversationResponse>>() {
            @Override
            public void onResponse(Call<List<ApiService.ChatConversationResponse>> call, Response<List<ApiService.ChatConversationResponse>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    chatList.clear();
                    for (ApiService.ChatConversationResponse item : response.body()) {
                        int avatarResId = R.drawable.ic_person_chat;
                        boolean isCustomer = true;
                        
                        if (item.partner_role != null) {
                            if (item.partner_role.equals("restaurant_owner")) {
                                avatarResId = R.drawable.ic_store;
                                isCustomer = false;
                            } else if (!item.partner_role.equals("customer")) {
                                avatarResId = R.drawable.ic_person;
                                isCustomer = false;
                            }
                        }

                        String timeDisplay = formatTime(item.time);
                        String orderTag = (item.orderId != null && !item.orderId.isEmpty()) ? "#" + item.orderId : null;
                        
                        chatList.add(new ChatSession(
                            item.partner_name,
                            timeDisplay,
                            item.lastMessage,
                            !item.is_read,
                            orderTag,
                            avatarResId,
                            isCustomer,
                            item.partner_id
                        ));
                    }
                    chatAdapter.notifyDataSetChanged();
                } else {
                    if (showErrors) {
                        android.widget.Toast.makeText(ChatActivity.this, "Không thể tải danh sách chat", android.widget.Toast.LENGTH_SHORT).show();
                    }
                }
            }

            @Override
            public void onFailure(Call<List<ApiService.ChatConversationResponse>> call, Throwable t) {
                if (showErrors) {
                    android.widget.Toast.makeText(ChatActivity.this, "Lỗi kết nối", android.widget.Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    private String formatTime(String isoTime) {
        if (isoTime == null) return "Vừa xong";
        try {
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
            sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
            java.util.Date date = sdf.parse(isoTime);
            
            long diff = System.currentTimeMillis() - date.getTime();
            if (diff < 60000) return "Vừa xong";
            if (diff < 3600000) return (diff / 60000) + " phút trước";
            if (diff < 86400000) {
                java.text.SimpleDateFormat timeFormat = new java.text.SimpleDateFormat("HH:mm");
                return timeFormat.format(date);
            }
            return "Hôm qua";
        } catch (Exception e) {
            return "Vừa xong";
        }
    }
    
    @Override
    public void onBackPressed() {
        super.onBackPressed();
        overridePendingTransition(android.R.anim.slide_in_left, android.R.anim.slide_out_right);
    }
}
