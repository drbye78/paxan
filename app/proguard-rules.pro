# Add project specific ProGuard rules here.

# Keep data classes
-keepclassmembers class com.peasyproxy.app.domain.model.** { *; }
-keepclassmembers class com.peasyproxy.app.data.local.entity.** { *; }

# Gson
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.google.gson.** { *; }
-keep class * extends com.google.gson.TypeAdapter
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# ApiModels — Gson @SerializedName fields
-keep class com.peasyproxy.app.data.remote.ApiModels* { *; }
-keep class com.peasyproxy.app.data.remote.ProxyFetcher* { *; }

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**

# Retrofit
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }

# Jsoup — uses reflection for CSS selectors
-keep class org.jsoup.** { *; }
-dontwarn org.jsoup.**

# Room — generated DAO implementations
-keep class com.peasyproxy.app.data.local.dao.** { *; }
-keep class * extends androidx.room.RoomDatabase
-dontwarn androidx.room.paging.**

# Hilt
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }
-keep class * extends dagger.hilt.android.lifecycle.HiltViewModel