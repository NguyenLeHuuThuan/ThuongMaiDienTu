package com.example.shipper_app.api;

import android.content.Context;
import android.content.SharedPreferences;

import java.io.IOException;

import okhttp3.Interceptor;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class ApiClient {
    // Thay đổi BASE_URL phù hợp với IP của máy chủ chạy Node.js
    // Ví dụ khi chạy máy ảo Android Studio (10.0.2.2) hoặc điện thoại thật (IP LAN mạng Wifi)
    //public static final String BASE_URL = "http://10.0.2.2:5000/";
    public static final String BASE_URL = "http://10.182.82.66:5000/";
    
    private static Retrofit retrofit = null;

    public static Retrofit getClient(Context context) {
        if (retrofit == null) {
            OkHttpClient client = new OkHttpClient.Builder()
                    .addInterceptor(new AuthInterceptor(context))
                    .build();

            retrofit = new Retrofit.Builder()
                    .baseUrl(BASE_URL)
                    .client(client)
                    .addConverterFactory(GsonConverterFactory.create())
                    .build();
        }
        return retrofit;
    }

    // Interceptor để thêm Bearer Token vào header mỗi khi gọi API
    private static class AuthInterceptor implements Interceptor {
        private Context context;

        public AuthInterceptor(Context context) {
            this.context = context;
        }

        @Override
        public Response intercept(Chain chain) throws IOException {
            Request originalRequest = chain.request();
            
            SharedPreferences prefs = context.getSharedPreferences("ShipperAppPrefs", Context.MODE_PRIVATE);
            String token = prefs.getString("token", null);

            if (token != null) {
                Request newRequest = originalRequest.newBuilder()
                        .header("Authorization", "Bearer " + token)
                        .build();
                Response response = chain.proceed(newRequest);
                
                // Tự động đăng xuất nếu token hết hạn (401)
                if (response.code() == 401) {
                    prefs.edit().remove("token").apply();
                    android.content.Intent intent = new android.content.Intent(context, com.example.shipper_app.LoginActivity.class);
                    intent.setFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK | android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK);
                    context.startActivity(intent);
                }
                
                return response;
            }

            return chain.proceed(originalRequest);
        }
    }
}
