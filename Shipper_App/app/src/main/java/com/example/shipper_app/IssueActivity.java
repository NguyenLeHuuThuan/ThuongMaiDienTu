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
    private android.widget.Spinner spinnerFilterStatus;
    private ImageButton btnBack, btnAddNewIssue;
    private RecyclerView rvComplaints;
    private ProgressBar progressBar;
    private TextView tvNoData;
    
    private ComplaintAdapter adapter;
    private List<Complaint> myComplaintsList = new ArrayList<>();
    private List<Complaint> complaintsAboutMeList = new ArrayList<>();
    
    private boolean isShowingMyComplaints = true;
    private String currentStatusFilter = "all"; // all, pending, resolved

    private android.os.Handler pollingHandler;
    private Runnable pollingRunnable;
    private static final int POLLING_INTERVAL = 3000;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_issue);

        initViews();
        setupRecyclerView();

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

        pollingHandler = new android.os.Handler(android.os.Looper.getMainLooper());
        pollingRunnable = new Runnable() {
            @Override
            public void run() {
                fetchComplaints(false);
                pollingHandler.postDelayed(this, POLLING_INTERVAL);
            }
        };
    }

    @Override
    protected void onResume() {
        super.onResume();
        fetchComplaints(true);
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
        btnBack = findViewById(R.id.btnBack);
        btnAddNewIssue = findViewById(R.id.btnAddNewIssue);
        btnMyComplaints = findViewById(R.id.btnMyComplaints);
        btnComplaintsAboutMe = findViewById(R.id.btnComplaintsAboutMe);
        spinnerFilterStatus = findViewById(R.id.spinnerFilterStatus);
        rvComplaints = findViewById(R.id.rvComplaints);
        progressBar = findViewById(R.id.progressBar);
        tvNoData = findViewById(R.id.tvNoData);

        String[] filterOptions = new String[]{"Tất cả", "Chờ xử lý", "Đã xử lý"};
        android.widget.ArrayAdapter<String> spinnerAdapter = new android.widget.ArrayAdapter<>(this, R.layout.item_spinner_selected, filterOptions);
        spinnerAdapter.setDropDownViewResource(R.layout.item_spinner_dropdown);
        spinnerFilterStatus.setAdapter(spinnerAdapter);
        
        spinnerFilterStatus.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(android.widget.AdapterView<?> parent, View view, int position, long id) {
                if (position == 0) {
                    currentStatusFilter = "all";
                } else if (position == 1) {
                    currentStatusFilter = "pending";
                } else if (position == 2) {
                    currentStatusFilter = "resolved";
                }
                updateList();
            }

            @Override
            public void onNothingSelected(android.widget.AdapterView<?> parent) {}
        });
    }

    private void setupRecyclerView() {
        rvComplaints.setLayoutManager(new LinearLayoutManager(this));
        adapter = new ComplaintAdapter(new ArrayList<>(), isShowingMyComplaints, complaint -> {
            // Remove from the appropriate list
            if (myComplaintsList.contains(complaint)) {
                myComplaintsList.remove(complaint);
            }
            if (complaintsAboutMeList.contains(complaint)) {
                complaintsAboutMeList.remove(complaint);
            }
            updateList();
        });
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
        // Update adapter boolean flag
        if (adapter != null) {
            // We just let updateList() handle the adapter data update.
        }
    }

    private void updateList() {
        List<Complaint> sourceList = isShowingMyComplaints ? myComplaintsList : complaintsAboutMeList;
        List<Complaint> filteredList = new ArrayList<>();
        
        for (Complaint complaint : sourceList) {
            boolean isResolved = "resolved".equalsIgnoreCase(complaint.getStatus());
            if (currentStatusFilter.equals("all")) {
                filteredList.add(complaint);
            } else if (currentStatusFilter.equals("pending") && !isResolved) {
                filteredList.add(complaint);
            } else if (currentStatusFilter.equals("resolved") && isResolved) {
                filteredList.add(complaint);
            }
        }

        if (filteredList.isEmpty()) {
            tvNoData.setVisibility(View.VISIBLE);
            rvComplaints.setVisibility(View.GONE);
        } else {
            tvNoData.setVisibility(View.GONE);
            rvComplaints.setVisibility(View.VISIBLE);
        }
        
        // Re-create adapter to ensure the flag is properly applied
        adapter = new ComplaintAdapter(filteredList, isShowingMyComplaints, complaint -> {
            if (myComplaintsList.contains(complaint)) {
                myComplaintsList.remove(complaint);
            }
            if (complaintsAboutMeList.contains(complaint)) {
                complaintsAboutMeList.remove(complaint);
            }
            updateList();
        });
        rvComplaints.setAdapter(adapter);
    }

    private void fetchComplaints() {
        fetchComplaints(true);
    }

    private void fetchComplaints(boolean showErrorsAndLoading) {
        if (showErrorsAndLoading) {
            progressBar.setVisibility(View.VISIBLE);
        }
        ApiService apiService = ApiClient.getClient(this).create(ApiService.class);
        apiService.getComplaints().enqueue(new Callback<ApiService.ComplaintResponse>() {
            @Override
            public void onResponse(Call<ApiService.ComplaintResponse> call, Response<ApiService.ComplaintResponse> response) {
                if (showErrorsAndLoading) {
                    progressBar.setVisibility(View.GONE);
                }
                if (response.isSuccessful() && response.body() != null) {
                    myComplaintsList = response.body().myComplaints != null ? response.body().myComplaints : new ArrayList<>();
                    complaintsAboutMeList = response.body().complaintsAboutMe != null ? response.body().complaintsAboutMe : new ArrayList<>();
                    
                    updateTabUI();
                    updateList();
                } else {
                    if (showErrorsAndLoading) {
                        Toast.makeText(IssueActivity.this, "Lỗi khi lấy dữ liệu sự cố", Toast.LENGTH_SHORT).show();
                    }
                }
            }

            @Override
            public void onFailure(Call<ApiService.ComplaintResponse> call, Throwable t) {
                if (showErrorsAndLoading) {
                    progressBar.setVisibility(View.GONE);
                    Toast.makeText(IssueActivity.this, "Lỗi kết nối: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                }
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
                    List<com.example.shipper_app.model.Order> validOrders = new ArrayList<>();
                    long currentTime = System.currentTimeMillis();

                    for (com.example.shipper_app.model.Order o : acceptedOrders) {
                        if ("delivered".equalsIgnoreCase(o.getOrderStatus())) {
                            if (o.getDeliveredAt() != null) {
                                long diff = currentTime - o.getDeliveredAt().getTime();
                                long diffDays = java.util.concurrent.TimeUnit.DAYS.convert(diff, java.util.concurrent.TimeUnit.MILLISECONDS);
                                if (diffDays <= 7) {
                                    validOrders.add(o);
                                }
                            }
                        } else {
                            validOrders.add(o);
                        }
                    }

                    if (validOrders.isEmpty()) {
                        Toast.makeText(IssueActivity.this, "Bạn chưa có đơn hàng nào hợp lệ để báo cáo", Toast.LENGTH_SHORT).show();
                        return;
                    }

                    String[] orderTitles = new String[validOrders.size()];
                    for (int i = 0; i < validOrders.size(); i++) {
                        com.example.shipper_app.model.Order o = validOrders.get(i);
                        orderTitles[i] = "Đơn #" + o.getOrderCode() + " - " + o.getRestaurantName();
                    }

                    new androidx.appcompat.app.AlertDialog.Builder(IssueActivity.this)
                            .setTitle("Chọn đơn hàng gặp sự cố")
                            .setItems(orderTitles, (dialog, which) -> {
                                com.example.shipper_app.model.Order selected = validOrders.get(which);
                                android.content.Intent intent = new android.content.Intent(IssueActivity.this, CreateIssueActivity.class);
                                intent.putExtra("ORDER_ID", selected.getIdOrder());
                                intent.putExtra("ORDER_CODE", selected.getOrderCode());
                                intent.putExtra("ORDER_OBJ", selected);
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
