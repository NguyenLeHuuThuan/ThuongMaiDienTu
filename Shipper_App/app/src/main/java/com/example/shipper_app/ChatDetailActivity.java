package com.example.shipper_app;

import android.os.Bundle;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.shipper_app.adapter.ChatMessageAdapter;
import com.example.shipper_app.api.ApiClient;
import com.example.shipper_app.api.ApiService;
import com.example.shipper_app.model.ChatMessage;
import com.example.shipper_app.model.api.ApiResponse;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ChatDetailActivity extends AppCompatActivity {

    private RecyclerView rvMessages;
    private ChatMessageAdapter adapter;
    private List<ChatMessage> messageList;
    private int partnerId;
    private String partnerName;
    private EditText etMessage;
    private ImageButton btnSend;

    private android.os.Handler pollingHandler;
    private Runnable pollingRunnable;
    private static final int POLLING_INTERVAL = 3000; 


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_chat_detail);

        partnerId = getIntent().getIntExtra("PARTNER_ID", -1);
        partnerName = getIntent().getStringExtra("PARTNER_NAME");

        TextView tvPartnerName = findViewById(R.id.tv_partner_name);
        tvPartnerName.setText(partnerName != null ? partnerName : "Chat");

        ImageButton btnBack = findViewById(R.id.btn_back);
        btnBack.setOnClickListener(v -> finish());

        rvMessages = findViewById(R.id.rv_messages);
        rvMessages.setLayoutManager(new LinearLayoutManager(this));
        
        messageList = new ArrayList<>();
        adapter = new ChatMessageAdapter(this, messageList);
        rvMessages.setAdapter(adapter);

        etMessage = findViewById(R.id.et_message);
        btnSend = findViewById(R.id.btn_send);

        String defaultMessage = getIntent().getStringExtra("DEFAULT_MESSAGE");
        if (defaultMessage != null && !defaultMessage.isEmpty()) {
            etMessage.setText(defaultMessage);
        }

        btnSend.setOnClickListener(v -> sendMessage());

        if (partnerId != -1) {
            loadMessages();
        }

        pollingHandler = new android.os.Handler(android.os.Looper.getMainLooper());
        pollingRunnable = new Runnable() {
            @Override
            public void run() {
                if (partnerId != -1) {
                    loadMessages();
                }
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

    private void loadMessages() {
        ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
        apiService.getMessages(partnerId).enqueue(new Callback<List<ApiService.ChatMessageResponse>>() {
            @Override
            public void onResponse(Call<List<ApiService.ChatMessageResponse>> call, Response<List<ApiService.ChatMessageResponse>> response) {
                if (response.isSuccessful() && response.body() != null) {
                    int oldSize = messageList.size();
                    messageList.clear();
                    for (ApiService.ChatMessageResponse msg : response.body()) {
                        boolean isSentByMe = (msg.sender_id != partnerId);
                        String timeDisplay = formatTime(msg.created_at);
                        messageList.add(new ChatMessage(msg.message_text, timeDisplay, isSentByMe));
                    }
                    adapter.notifyDataSetChanged();
                    
                    if (!messageList.isEmpty() && (oldSize == 0 || messageList.size() > oldSize)) {
                        rvMessages.scrollToPosition(messageList.size() - 1);
                    }
                    
                    // Mark as read
                    apiService.markMessagesAsRead(partnerId).enqueue(new Callback<ApiResponse>() {
                        @Override
                        public void onResponse(Call<ApiResponse> call, Response<ApiResponse> response) {}
                        @Override
                        public void onFailure(Call<ApiResponse> call, Throwable t) {}
                    });
                }
            }

            @Override
            public void onFailure(Call<List<ApiService.ChatMessageResponse>> call, Throwable t) {
                // Không hiện Toast ở đây để tránh spam màn hình khi mất mạng vì hàm này gọi liên tục 3s/lần
            }
        });
    }

    private void sendMessage() {
        String text = etMessage.getText().toString().trim();
        if (text.isEmpty()) return;

        ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
        ApiService.SendMessageRequest request = new ApiService.SendMessageRequest(partnerId, text);
        
        apiService.sendMessage(request).enqueue(new Callback<ApiResponse>() {
            @Override
            public void onResponse(Call<ApiResponse> call, Response<ApiResponse> response) {
                if (response.isSuccessful()) {
                    etMessage.setText("");
                    loadMessages();
                } else {
                    Toast.makeText(ChatDetailActivity.this, "Không thể gửi tin nhắn", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiResponse> call, Throwable t) {
                Toast.makeText(ChatDetailActivity.this, "Lỗi mạng", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private String formatTime(String isoTime) {
        if (isoTime == null) return "Vừa xong";
        try {
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
            sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
            java.util.Date date = sdf.parse(isoTime);
            
            java.text.SimpleDateFormat timeFormat = new java.text.SimpleDateFormat("HH:mm");
            return timeFormat.format(date);
        } catch (Exception e) {
            return "";
        }
    }
}
