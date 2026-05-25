package com.example.shipper_app;

import android.content.res.ColorStateList;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ImageButton;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.shipper_app.adapter.ComplaintAdapter;
import com.example.shipper_app.api.ApiClient;
import com.example.shipper_app.api.ApiService;
import com.example.shipper_app.model.Complaint;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class IssueActivity extends AppCompatActivity {

    private Button btnMyComplaints, btnComplaintsAboutMe;
    private ImageButton btnBack, btnAddNewIssue;
    private RecyclerView rvComplaints;
    private ProgressBar progressBar;
    private TextView tvNoData;
    
    private ComplaintAdapter adapter;
    private List<Complaint> myComplaintsList = new ArrayList<>();
    private List<Complaint> complaintsAboutMeList = new ArrayList<>();
    
    private boolean isShowingMyComplaints = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_issue);

        initViews();
        setupRecyclerView();
        fetchComplaints();

        btnBack.setOnClickListener(v -> finish());
        
        btnAddNewIssue.setOnClickListener(v -> showSelectOrderDialog());

        btnMyComplaints.setOnClickListener(v -> {
            isShowingMyComplaints = true;
            updateTabUI();
            updateList();
        });

        btnComplaintsAboutMe.setOnClickListener(v -> {
            isShowingMyComplaints = false;
            updateTabUI();
            updateList();
        });
    }

    private void initViews() {
        btnBack = findViewById(R.id.btnBack);
        btnAddNewIssue = findViewById(R.id.btnAddNewIssue);
        btnMyComplaints = findViewById(R.id.btnMyComplaints);
        btnComplaintsAboutMe = findViewById(R.id.btnComplaintsAboutMe);
        rvComplaints = findViewById(R.id.rvComplaints);
        progressBar = findViewById(R.id.progressBar);
        tvNoData = findViewById(R.id.tvNoData);
    }

    private void setupRecyclerView() {
        rvComplaints.setLayoutManager(new LinearLayoutManager(this));
        adapter = new ComplaintAdapter(new ArrayList<>(), isShowingMyComplaints);
        rvComplaints.setAdapter(adapter);
    }

    private void updateTabUI() {
        if (isShowingMyComplaints) {
            btnMyComplaints.setBackgroundTintList(ColorStateList.valueOf(Color.parseColor("#FF6600")));
            btnMyComplaints.setTextColor(Color.WHITE);
            btnComplaintsAboutMe.setBackgroundTintList(ColorStateList.valueOf(Color.parseColor("#E0E0E0")));
            btnComplaintsAboutMe.setTextColor(Color.parseColor("#333333"));
        } else {
            btnComplaintsAboutMe.setBackgroundTintList(ColorStateList.valueOf(Color.parseColor("#FF6600")));
            btnComplaintsAboutMe.setTextColor(Color.WHITE);
            btnMyComplaints.setBackgroundTintList(ColorStateList.valueOf(Color.parseColor("#E0E0E0")));
            btnMyComplaints.setTextColor(Color.parseColor("#333333"));
        }
        
        // Recreate adapter to update the boolean flag for title formatting
        adapter = new ComplaintAdapter(isShowingMyComplaints ? myComplaintsList : complaintsAboutMeList, isShowingMyComplaints);
        rvComplaints.setAdapter(adapter);
    }

    private void updateList() {
        List<Complaint> currentList = isShowingMyComplaints ? myComplaintsList : complaintsAboutMeList;
        if (currentList.isEmpty()) {
            tvNoData.setVisibility(View.VISIBLE);
            rvComplaints.setVisibility(View.GONE);
        } else {
            tvNoData.setVisibility(View.GONE);
            rvComplaints.setVisibility(View.VISIBLE);
        }
    }

    private void fetchComplaints() {
        progressBar.setVisibility(View.VISIBLE);
        ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
        apiService.getComplaints().enqueue(new Callback<ApiService.ComplaintResponse>() {
            @Override
            public void onResponse(Call<ApiService.ComplaintResponse> call, Response<ApiService.ComplaintResponse> response) {
                progressBar.setVisibility(View.GONE);
                if (response.isSuccessful() && response.body() != null) {
                    myComplaintsList = response.body().myComplaints != null ? response.body().myComplaints : new ArrayList<>();
                    complaintsAboutMeList = response.body().complaintsAboutMe != null ? response.body().complaintsAboutMe : new ArrayList<>();
                    
                    updateTabUI();
                    updateList();
                } else {
                    Toast.makeText(IssueActivity.this, "Lỗi khi lấy dữ liệu sự cố", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<ApiService.ComplaintResponse> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                Toast.makeText(IssueActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void showSelectOrderDialog() {
        progressBar.setVisibility(View.VISIBLE);
        ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
        apiService.getAcceptedOrders().enqueue(new Callback<List<com.example.shipper_app.model.Order>>() {
            @Override
            public void onResponse(Call<List<com.example.shipper_app.model.Order>> call, Response<List<com.example.shipper_app.model.Order>> response) {
                progressBar.setVisibility(View.GONE);
                if (response.isSuccessful() && response.body() != null) {
                    List<com.example.shipper_app.model.Order> acceptedOrders = response.body();
                    if (acceptedOrders.isEmpty()) {
                        Toast.makeText(IssueActivity.this, "Bạn chưa có đơn hàng nào đang xử lý để báo cáo", Toast.LENGTH_SHORT).show();
                        return;
                    }

                    String[] orderTitles = new String[acceptedOrders.size()];
                    for (int i = 0; i < acceptedOrders.size(); i++) {
                        com.example.shipper_app.model.Order o = acceptedOrders.get(i);
                        orderTitles[i] = "Đơn #" + o.getOrderCode() + " - " + o.getRestaurantName();
                    }

                    new androidx.appcompat.app.AlertDialog.Builder(IssueActivity.this)
                            .setTitle("Chọn đơn hàng gặp sự cố")
                            .setItems(orderTitles, (dialog, which) -> {
                                com.example.shipper_app.model.Order selected = acceptedOrders.get(which);
                                android.content.Intent intent = new android.content.Intent(IssueActivity.this, CreateIssueActivity.class);
                                intent.putExtra("ORDER_ID", selected.getIdOrder());
                                intent.putExtra("ORDER_CODE", selected.getOrderCode());
                                startActivity(intent);
                            })
                            .setNegativeButton("Hủy", null)
                            .show();
                } else {
                    Toast.makeText(IssueActivity.this, "Lỗi tải danh sách đơn hàng", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<List<com.example.shipper_app.model.Order>> call, Throwable t) {
                progressBar.setVisibility(View.GONE);
                Toast.makeText(IssueActivity.this, "Lỗi kết nối", Toast.LENGTH_SHORT).show();
            }
        });
    }
}
